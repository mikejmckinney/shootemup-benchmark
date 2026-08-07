#!/usr/bin/env python3
"""Asynchronous A2A streaming client with durable idempotency."""

from __future__ import annotations

import argparse
import asyncio
import fcntl
import hashlib
import json
import time
from pathlib import Path

import httpx
from a2a.client import A2ACardResolver, ClientConfig, create_client
from a2a.helpers import new_text_message
from a2a.types import GetTaskRequest, Role, SendMessageConfiguration, SendMessageRequest, SubscribeToTaskRequest
from google.protobuf.json_format import MessageToDict
from google.protobuf.struct_pb2 import Struct

TERMINAL = {
    "TASK_STATE_COMPLETED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED",
    "TASK_STATE_REJECTED", "TASK_STATE_INPUT_REQUIRED", "TASK_STATE_AUTH_REQUIRED",
}


def dump(message) -> dict:
    return MessageToDict(message, preserving_proto_field_name=True)


def stream_summary(item) -> dict:
    value = dump(item)
    if item.HasField("task"):
        task = value["task"]
        state = task.get("status", {}).get("state", "TASK_STATE_UNSPECIFIED")
        return {"task_id": task.get("id"), "state": state, "terminal": state in TERMINAL, "event": "task", "value": value}
    if item.HasField("status_update"):
        update = value["status_update"]
        state = update.get("status", {}).get("state", "TASK_STATE_UNSPECIFIED")
        return {"task_id": update.get("task_id"), "state": state, "terminal": state in TERMINAL, "event": "status_update", "value": value}
    if item.HasField("artifact_update"):
        return {"task_id": value["artifact_update"].get("task_id"), "state": None, "terminal": False, "event": "artifact_update", "value": value}
    return {"task_id": None, "state": None, "terminal": False, "event": "message", "value": value}


def append_event(state_path: Path, event: dict) -> None:
    event_path = state_path.with_suffix(".events.jsonl")
    with event_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": time.time(), **event}, separators=(",", ":")) + "\n")


def locked_state(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = path.open("a+", encoding="utf-8")
    fcntl.flock(handle, fcntl.LOCK_EX)
    handle.seek(0)
    try:
        value = json.load(handle)
    except (json.JSONDecodeError, ValueError):
        value = {"requests": {}}
    value.setdefault("requests", {})
    return handle, value


def save_state(handle, value: dict) -> None:
    handle.seek(0)
    handle.truncate()
    json.dump(value, handle, indent=2, sort_keys=True)
    handle.write("\n")
    handle.flush()


async def open_client(base_url: str):
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(1250.0, connect=5.0))
    card = await A2ACardResolver(httpx_client=http_client, base_url=base_url).get_agent_card()
    if not card.capabilities.streaming:
        raise RuntimeError("agent card does not advertise streaming")
    client = await create_client(agent=card, client_config=ClientConfig(streaming=True, polling=False))
    return http_client, client


async def get_task(base_url: str, task_id: str):
    http_client, client = await open_client(base_url)
    try:
        return await client.get_task(GetTaskRequest(id=task_id, history_length=10))
    finally:
        await client.close()
        await http_client.aclose()


async def submit(state_path: Path, base_url: str, key: str, message: str) -> dict:
    digest = hashlib.sha256(message.encode()).hexdigest()
    registry_key = f"{base_url}|{key}"
    handle, state = locked_state(state_path)
    try:
        prior = state["requests"].get(registry_key)
        if prior:
            if prior["message_sha256"] != digest:
                raise ValueError("idempotency key was already used for a different message")
            task = dump(await get_task(base_url, prior["task_id"]))
            result = {"task_id": task.get("id"), "state": task.get("status", {}).get("state"), "idempotency_reused": True}
            append_event(state_path, {"event": "stream_submit_reused", "key": key, **result})
            return result

        metadata = Struct()
        metadata.update({"idempotency_key": key, "retry_owner": "coordinator", "transport": "a2a_streaming"})
        request = SendMessageRequest(
            message=new_text_message(message, role=Role.ROLE_USER),
            configuration=SendMessageConfiguration(return_immediately=False, history_length=10),
            metadata=metadata,
        )
        http_client, client = await open_client(base_url)
        first = None
        try:
            async for item in client.send_message(request):
                summary = stream_summary(item)
                append_event(state_path, {"event": "stream_submit_event", "stream_event": summary["event"], "key": key, **{k: summary[k] for k in ("task_id", "state", "terminal")}})
                if summary["task_id"]:
                    first = summary
                    break
        finally:
            await client.close()
            await http_client.aclose()
        if not first or not first["task_id"]:
            raise RuntimeError("streaming submission did not return a task id")
        state["requests"][registry_key] = {
            "base_url": base_url, "idempotency_key": key, "message_sha256": digest,
            "task_id": first["task_id"], "submitted_at": time.time(), "retry_owner": "coordinator",
        }
        save_state(handle, state)
        return {"task_id": first["task_id"], "state": first["state"], "idempotency_reused": False}
    finally:
        fcntl.flock(handle, fcntl.LOCK_UN)
        handle.close()


async def watch(state_path: Path, base_url: str, key: str) -> dict:
    handle, state = locked_state(state_path)
    try:
        record = state["requests"].get(f"{base_url}|{key}")
    finally:
        fcntl.flock(handle, fcntl.LOCK_UN)
        handle.close()
    if not record:
        raise KeyError("unknown idempotency key")

    current = dump(await get_task(base_url, record["task_id"]))
    current_state = current.get("status", {}).get("state", "TASK_STATE_UNSPECIFIED")
    if current_state in TERMINAL:
        result = {"task_id": record["task_id"], "state": current_state, "terminal": True, "task": current}
        append_event(state_path, {"event": "stream_terminal_snapshot", "key": key, "task_id": record["task_id"], "state": current_state})
        return result

    http_client, client = await open_client(base_url)
    final = {"task_id": record["task_id"], "state": current_state, "terminal": False}
    try:
        async for item in client.subscribe(SubscribeToTaskRequest(id=record["task_id"])):
            summary = stream_summary(item)
            append_event(state_path, {"event": "stream_update", "stream_event": summary["event"], "key": key, **{k: summary[k] for k in ("task_id", "state", "terminal")}})
            if summary["state"]:
                final = summary
            if summary["terminal"]:
                break
    finally:
        await client.close()
        await http_client.aclose()
    final["task"] = dump(await get_task(base_url, record["task_id"]))
    return final


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", required=True, type=Path)
    sub = parser.add_subparsers(dest="command", required=True)
    submit_parser = sub.add_parser("submit")
    submit_parser.add_argument("base_url")
    submit_parser.add_argument("key")
    submit_parser.add_argument("message")
    watch_parser = sub.add_parser("watch")
    watch_parser.add_argument("base_url")
    watch_parser.add_argument("key")
    args = parser.parse_args()
    if args.command == "submit":
        result = asyncio.run(submit(args.state, args.base_url, args.key, args.message))
    else:
        result = asyncio.run(watch(args.state, args.base_url, args.key))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

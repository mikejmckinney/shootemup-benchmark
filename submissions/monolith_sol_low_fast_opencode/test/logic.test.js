import test from 'node:test';import assert from 'node:assert/strict';import {clamp,overlaps,validName,difficulty} from '../public/logic.js';
test('clamps player bounds',()=>{assert.equal(clamp(-2,0,10),0);assert.equal(clamp(12,0,10),10)});
test('detects projectile collision',()=>{assert.equal(overlaps({x:0,y:0,w:5,h:5},{x:4,y:4,w:5,h:5}),true);assert.equal(overlaps({x:0,y:0,w:2,h:2},{x:3,y:3,w:2,h:2}),false)});
test('validates leaderboard callsigns',()=>{assert.equal(validName('ACE_9'),true);assert.equal(validName(' bad'),false);assert.equal(validName('<script>'),false);assert.equal(validName('abcdefghijklmnopq'),false)});
test('difficulty escalates safely',()=>{assert.ok(difficulty(500).spawnMs<difficulty(0).spawnMs);assert.ok(difficulty(99999).spawnMs>=260);assert.ok(difficulty(99999).speed<=250)});

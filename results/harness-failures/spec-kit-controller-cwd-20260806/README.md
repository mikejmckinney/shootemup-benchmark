# Excluded Spec Kit harness attempt

The first Spec Kit controller attempt began at `2026-08-06T19:44:16Z` and stopped after 26 seconds with zero model tokens. The pinned Spec Kit `v0.16.0` bootstrap succeeded, but the controller invoked `specify init --here` from the benchmark root instead of the candidate directory. Consequently, OpenCode could not find the generated project command in the candidate repository.

This is classified as a benchmark-harness failure and excluded from candidate ROI and quality scoring. The failed candidate directory, raw telemetry, and accidentally root-installed Spec Kit files are retained beside this note. No Supabase project or Cloudflare deployment was created. The runner was corrected to execute initialization from the candidate directory before the treatment was restarted from a fresh candidate repository.

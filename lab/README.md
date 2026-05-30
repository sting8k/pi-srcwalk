# Lab

Historical prototype and benchmark material lives here. The runtime Pi extension is TypeScript-only under `src/` and `extensions/`.

## Python prototypes

```bash
cd lab/python
python3 router_lab_v9.py --lab
python3 router_lab_v9.py --lab --only-repo ghidra
python3 router_lab_v9.py --lab --embedding
```

The Python lab remains useful for:

- benchmark comparison against v9 behavior,
- optional embedding experiments,
- archaeology of router iterations.

It is not a runtime dependency of the Pi extension.

## Reports

Benchmark reports are stored under `lab/reports/`.

// Compiler profile for the fetched Stockfish sources (see scripts/fetch-stockfish.sh).
//
// Mirrors the upstream Makefile, not a new port:
//   arm64  (device and Apple Silicon simulator) → ARCH=armv8: NEON, popcnt.
//   x86_64 (Intel simulator)                    → ARCH=x86-64-sse41-popcnt.
//
// Dotprod (ARMv8.2) is left off. The pod deployment target is iOS 15.1, which
// still includes A9–A11 devices that do not have that instruction.
//
// Force-included from Stockfish.podspec so the gitignored engine sources
// stay unmodified.

#pragma once

#if defined(__aarch64__)
#define USE_NEON 8
#define USE_POPCNT
#elif defined(__x86_64__)
#define USE_SSE41
#define USE_SSSE3
#define USE_SSE2
#define USE_POPCNT
#endif

// iOS 15+ is 64-bit only. types.h defines IS_64BIT itself only for MSVC.
#define IS_64BIT

// Makefile default. On Apple the pthread path is also selected via __APPLE__.
#define USE_PTHREADS

// Release builds match `make` (debug=no). CocoaPods sets DEBUG=1 for Debug.
#if !defined(DEBUG)
#define NDEBUG
#endif

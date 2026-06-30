#ifndef STOCKFISH_BRIDGE_H
#define STOCKFISH_BRIDGE_H

// Stockfish's entry point, renamed from `main` via the podspec preprocessor
// define (main=stockfish_main). Exposed to Swift through this bridging header so
// StockfishModule.swift can launch the UCI loop on a background thread.
#ifdef __cplusplus
extern "C" {
#endif

int stockfish_main(int argc, char** argv);

#ifdef __cplusplus
}
#endif

#endif /* STOCKFISH_BRIDGE_H */

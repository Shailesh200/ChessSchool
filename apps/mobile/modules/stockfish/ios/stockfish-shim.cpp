// C-linkage entry point so Swift (via stockfish-bridge.h) can launch the engine.
//
// Stockfish's own `main` is renamed to `stockfish_cpp_main` by the podspec
// (-Dmain=stockfish_cpp_main) and therefore has C++ linkage (name-mangled). The
// Swift bridge expects an un-mangled C symbol `stockfish_main`, so we wrap it.
int stockfish_cpp_main(int argc, char** argv);  // the renamed Stockfish main (C++ linkage)

extern "C" int stockfish_main(int argc, char** argv) {
  return stockfish_cpp_main(argc, argv);
}

require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'Stockfish'
  s.version        = '1.0.0'
  s.summary        = 'Bundled Stockfish UCI engine for ChessSchool (native dev build).'
  s.license        = 'GPL-3.0'  # Stockfish is GPLv3 — keep this license file in the repo.
  s.author         = 'ChessSchool'
  s.homepage       = 'https://github.com/Shailesh200/ChessSchool'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift module + the Stockfish C++ engine sources (added under ios/engine — see STOCKFISH.md).
  s.source_files = 'StockfishModule.swift', 'stockfish-bridge.h', 'engine/**/*.{cpp,h}'
  # Only the C bridge is public → it lands in the framework umbrella so Swift can
  # see `stockfish_main` (bridging headers aren't allowed for framework targets).
  s.public_header_files = 'stockfish-bridge.h'
  # The NNUE nets are bundled as resources (loaded at runtime via setoption EvalFile).
  s.resources    = 'engine/*.nnue'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'CLANG_CXX_LIBRARY' => 'libc++',
    # Rename Stockfish's main() so we can call it from Swift as stockfish_main(),
    # and let the assembler find the embedded NNUE nets next to evaluate.cpp.
    'GCC_PREPROCESSOR_DEFINITIONS' => 'main=stockfish_main',
    'OTHER_CFLAGS' => '-I${PODS_TARGET_SRCROOT}/engine',
    'OTHER_CPLUSPLUSFLAGS' => '-I${PODS_TARGET_SRCROOT}/engine',
  }
end

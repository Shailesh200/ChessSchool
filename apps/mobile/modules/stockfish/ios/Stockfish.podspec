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

  # Swift module + the C-linkage shim + the fetched Stockfish C++ sources.
  # engine/ is not in git. scripts/fetch-stockfish.sh fills it (sf_18 sources,
  # both NNUE nets, Copying.txt, AUTHORS) before pod install on iOS.
  s.source_files = 'StockfishModule.swift', 'stockfish-bridge.h', 'stockfish-shim.cpp', 'engine/**/*.{cpp,h}'
  # Only the C bridge is public → it lands in the framework umbrella so Swift can
  # see `stockfish_main` (bridging headers aren't allowed for framework targets).
  s.public_header_files = 'stockfish-bridge.h'
  # network.cpp embeds the nets with incbin (what the default UCI options use).
  # The same files are also copied into the app bundle as resources — the
  # original pod layout. That second copy is the bulk of the app-size cost;
  # sizes are in STOCKFISH.md.
  s.resources    = 'engine/*.nnue'

  # -I engine lets incbin find nn-*.nnue. -include applies the iOS arch profile
  # (NEON on arm64, SSE4.1 on x86_64 simulator) without editing fetched sources.
  # The x86_64 lines repeat -I/-include because an arch-specific OTHER_* flag
  # replaces the unconditional one for that architecture.
  cxx_common = '-I${PODS_TARGET_SRCROOT}/engine -include ${PODS_TARGET_SRCROOT}/stockfish-config.h'
  c_common = '-I${PODS_TARGET_SRCROOT}/engine'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'CLANG_CXX_LIBRARY' => 'libc++',
    # Rename Stockfish's main() → stockfish_cpp_main (C++); the shim re-exports it
    # with C linkage as stockfish_main for Swift.
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) main=stockfish_cpp_main',
    'OTHER_CFLAGS' => c_common,
    'OTHER_CPLUSPLUSFLAGS' => cxx_common,
    'OTHER_CFLAGS[arch=x86_64]' => "#{c_common} -msse4.1 -mssse3 -mpopcnt",
    'OTHER_CPLUSPLUSFLAGS[arch=x86_64]' => "#{cxx_common} -msse4.1 -mssse3 -mpopcnt",
  }
end

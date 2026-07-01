import ExpoModulesCore
import Foundation

// Bridges the bundled Stockfish C++ engine to JS over UCI.
//
// Stockfish is a CLI that talks UCI on stdin/stdout. We run its `main` (renamed
// to `stockfish_main` via the podspec's `-Dmain=stockfish_main`) on a background
// thread with stdin/stdout rewired to pipes, write UCI commands into the input
// pipe, and stream each output line back to JS as a "stockfish-output" event.
public class StockfishModule: Module {
  private var engineThread: Thread?
  private var readThread: Thread?
  private var inPipe = Pipe()   // JS → engine (commands)
  private var outPipe = Pipe()  // engine → JS (UCI output)
  private var started = false

  public func definition() -> ModuleDefinition {
    Name("Stockfish")
    Events("stockfish-output")

    Function("isReady") { () -> Bool in self.started }

    Function("start") {
      guard !self.started else { return }
      self.started = true

      // Rewire the engine's stdin/stdout to our pipes.
      dup2(self.inPipe.fileHandleForReading.fileDescriptor, STDIN_FILENO)
      dup2(self.outPipe.fileHandleForWriting.fileDescriptor, STDOUT_FILENO)
      setvbuf(stdout, nil, _IONBF, 0)

      // Reader: emit each output line to JS.
      let reader = Thread {
        let handle = self.outPipe.fileHandleForReading
        var buffer = Data()
        while true {
          let chunk = handle.availableData
          if chunk.isEmpty { continue }
          buffer.append(chunk)
          while let nl = buffer.firstIndex(of: 0x0A) {
            let lineData = buffer.subdata(in: buffer.startIndex..<nl)
            buffer.removeSubrange(buffer.startIndex...nl)
            if let line = String(data: lineData, encoding: .utf8), !line.isEmpty {
              self.sendEvent("stockfish-output", ["line": line])
            }
          }
        }
      }
      reader.stackSize = 1 << 20
      reader.start()
      self.readThread = reader

      // Engine: run Stockfish's UCI loop.
      let engine = Thread {
        var argv: [UnsafeMutablePointer<CChar>?] = [strdup("stockfish")]
        stockfish_main(1, &argv)   // provided by the C++ engine (see podspec)
      }
      engine.stackSize = 8 << 20   // Stockfish wants a big stack
      engine.start()
      self.engineThread = engine
    }

    Function("sendCommand") { (cmd: String) in
      guard self.started else { return }
      if let data = (cmd + "\n").data(using: .utf8) {
        self.inPipe.fileHandleForWriting.write(data)
      }
    }
  }
}

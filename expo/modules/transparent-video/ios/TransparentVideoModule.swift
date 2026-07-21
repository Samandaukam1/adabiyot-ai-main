import ExpoModulesCore

public class TransparentVideoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TransparentVideo")

    View(TransparentVideoView.self) {
      Prop("source") { (view: TransparentVideoView, source: String?) in
        view.setSource(source)
      }
    }
  }
}

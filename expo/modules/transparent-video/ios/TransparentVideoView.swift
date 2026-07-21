import AVFoundation
import ExpoModulesCore
import UIKit

// Renders a video with its alpha channel composited transparently.
//
// expo-video draws through AVPlayerViewController, whose video surface is
// opaque — it ignores the HEVC alpha channel and shows the raw RGB (e.g. the
// leftover green/key colour). AVPlayerLayer on a NON-opaque view composites the
// alpha correctly, so transparent pixels reveal whatever is behind the view.
final class TransparentVideoView: ExpoView {
  private let playerLayer = AVPlayerLayer()
  private var player: AVQueuePlayer?
  private var looper: AVPlayerLooper?
  private var currentSource: String?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // Non-opaque hosting view + clear layer background → alpha shows through.
    backgroundColor = .clear
    isOpaque = false
    playerLayer.videoGravity = .resizeAspect
    playerLayer.backgroundColor = UIColor.clear.cgColor
    playerLayer.isOpaque = false
    layer.addSublayer(playerLayer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    playerLayer.frame = bounds
  }

  // Bound to the `source` prop from JS.
  func setSource(_ source: String?) {
    guard let source = source, !source.isEmpty else {
      teardown()
      currentSource = nil
      return
    }
    if source == currentSource { return }
    currentSource = source
    guard let url = URL(string: source) else { return }

    teardown()
    let item = AVPlayerItem(url: url)
    let queue = AVQueuePlayer()
    queue.isMuted = true
    queue.actionAtItemEnd = .advance
    // Seamless gapless loop for the looping avatar clip.
    looper = AVPlayerLooper(player: queue, templateItem: item)
    player = queue
    playerLayer.player = queue
    queue.play()
  }

  private func teardown() {
    player?.pause()
    looper?.disableLooping()
    looper = nil
    player = nil
    playerLayer.player = nil
  }

  deinit {
    teardown()
  }
}

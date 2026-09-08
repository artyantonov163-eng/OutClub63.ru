import Foundation
import Vision
import CoreImage
import ImageIO
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let context=CIContext(options:[.useSoftwareRenderer:false])
for i in 1...15 {
 let id=String(format:"player-%02d",i)
 do {
  let source=root.appendingPathComponent("private/media/players/\(id).jpg")
  let handler=VNImageRequestHandler(url:source,options:[:])
  let request=VNGenerateForegroundInstanceMaskRequest()
  try handler.perform([request])
  guard let observation=request.results?.first, !observation.allInstances.isEmpty else {print("FAIL \(id) no foreground");continue}
  let buffer=try observation.generateMaskedImage(ofInstances:observation.allInstances,from:handler,croppedToInstancesExtent:true)
  let ci=CIImage(cvPixelBuffer:buffer)
  let dest=root.appendingPathComponent("private/media/portraits/\(id).png")
  try context.writePNGRepresentation(of:ci,to:dest,format:.RGBA8,colorSpace:CGColorSpaceCreateDeviceRGB())
  print("OK \(id) \(Int(ci.extent.width))x\(Int(ci.extent.height)) instances=\(observation.allInstances.count)")
 }catch {print("FAIL \(id) \(error)")}
}

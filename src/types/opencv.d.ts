// OpenCV.js 全局类型声明
declare namespace cv {
  class Mat {
    constructor()
    cols: number
    rows: number
    delete(): void
    clone(): Mat
    roi(rect: Rect): Mat
  }

  class Size {
    constructor(width: number, height: number)
    width: number
    height: number
  }

  class Point {
    constructor(x: number, y: number)
    x: number
    y: number
  }

  class Rect {
    constructor(x: number, y: number, width: number, height: number)
    x: number
    y: number
    width: number
    height: number
  }

  class Scalar {
    constructor(v0?: number, v1?: number, v2?: number, v3?: number)
  }

  // 颜色转换常量
  const COLOR_RGBA2GRAY: number
  const COLOR_BGR2GRAY: number
  const COLOR_RGB2GRAY: number

  // 插值方法
  const INTER_LINEAR: number
  const INTER_AREA: number

  // 边界处理
  const BORDER_CONSTANT: number

  // 模板匹配方法
  const TM_CCOEFF_NORMED: number

  // 32位浮点数矩阵类型
  const CV_32FC1: number

  // 函数声明
  function imread(imageSource: HTMLImageElement | HTMLCanvasElement | ImageData): Mat
  function imshow(canvasSource: HTMLCanvasElement | string, mat: Mat): void
  function cvtColor(src: Mat, dst: Mat, code: number, dstCn?: number): void
  function Canny(image: Mat, edges: Mat, threshold1: number, threshold2: number, apertureSize?: number, L2gradient?: boolean): void
  function matchTemplate(image: Mat, templ: Mat, result: Mat, method: number, mask?: Mat): void
  function resize(src: Mat, dst: Mat, dsize: Size, fx?: number, fy?: number, interpolation?: number): void
  function warpAffine(src: Mat, dst: Mat, M: Mat, dsize: Size, flags?: number, borderMode?: number, borderValue?: Scalar): void
  function getRotationMatrix2D(center: Point, angle: number, scale: number): Mat
  function minMaxLoc(src: Mat, mask?: Mat): { minVal: number; maxVal: number; minLoc: Point; maxLoc: Point }
}

declare const cv: {
  Mat: typeof cv.Mat
  Size: typeof cv.Size
  Point: typeof cv.Point
  Rect: typeof cv.Rect
  Scalar: typeof cv.Scalar
  COLOR_RGBA2GRAY: number
  COLOR_BGR2GRAY: number
  COLOR_RGB2GRAY: number
  INTER_LINEAR: number
  INTER_AREA: number
  BORDER_CONSTANT: number
  TM_CCOEFF_NORMED: number
  CV_32FC1: number
  imread: (imageSource: HTMLImageElement | HTMLCanvasElement | ImageData) => cv.Mat
  imshow: (canvasSource: HTMLCanvasElement | string, mat: cv.Mat) => void
  cvtColor: (src: cv.Mat, dst: cv.Mat, code: number, dstCn?: number) => void
  Canny: (image: cv.Mat, edges: cv.Mat, threshold1: number, threshold2: number, apertureSize?: number, L2gradient?: boolean) => void
  matchTemplate: (image: cv.Mat, templ: cv.Mat, result: cv.Mat, method: number, mask?: cv.Mat) => void
  resize: (src: cv.Mat, dst: cv.Mat, dsize: cv.Size, fx?: number, fy?: number, interpolation?: number) => void
  warpAffine: (src: cv.Mat, dst: cv.Mat, M: cv.Mat, dsize: cv.Size, flags?: number, borderMode?: number, borderValue?: cv.Scalar) => void
  getRotationMatrix2D: (center: cv.Point, angle: number, scale: number) => cv.Mat
  minMaxLoc: (src: cv.Mat, mask?: cv.Mat) => { minVal: number; maxVal: number; minLoc: cv.Point; maxLoc: cv.Point }
}

declare interface Window {
  cv: typeof cv
}

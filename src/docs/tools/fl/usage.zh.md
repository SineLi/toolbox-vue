## 简介
利用本工具实现荧光/比色可视化照片一站式处理，包含图片匹配裁切、图片拼接、颜色识别共三个模块
## 快速上手

### 从单张图片开始

<center>
<img src='src/docs/tools/fl/img/1.png' style="max-width:75%;max-height:240px">
</center>

在使用相机拍摄单个比色皿照片后总是需要将每一张照片中的皿裁切出来并且拼合到一张图像中，这个过程总是比较繁琐且需要耐心操作，而本工具可以实现自动识别并裁切以及自动拼合的功能。

#### 1.上传模板图像

软件需要先上传一张模板图像，即需要寻找的物体标准图像。模板图像需要包含被搜索的物体的主要特征，且不建议过度裁切。
例如在拍摄的一系列包含比色皿的照片中手动裁切出一张只包含皿的图像，以下为一个良好的模板图像示例。
<center>
<a href='src/docs/tools/fl/img/2.png' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/2.png' style="max-width:50%;max-height:240px">
</a>
</center>

#### 2.上传待处理的图像

选择一系列同样环境拍摄（角度相近、目标在图片中大小一致）的照片上传，软件将自动根据模板图像查找待处理图像中的目标，并将其裁剪出来。
<center>
<a href='src/docs/tools/fl/img/3.png' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/3.png' style="max-width:75%;max-height:240px">
</a>
</center>
同时可以上传多张待处理图像，全部识别结束后会自动进入拼接板块。

#### 3.对裁切后的图像进行拼接

在拼接板块中，可以自定义各个裁切后图像的间距、组图边框尺寸，并给各个图像记录标签（例如浓度等），标签、背景的颜色等均可自定义。
*注意：在调整各个参数后需要点击`重新生成`按钮才会更新图像*
拼接完成后可以下载拼接后的图像，或进入下一步进行颜色识别。
<center>
<a href='src/docs/tools/fl/img/4.jpg' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/4.jpg' style="max-width:100%;max-height:240px">
</a>
</center>

### 直接识别组图颜色

颜色识别板块中，可以在拼接的图像上选取采样区域并设置各个采样点对应的标记（或横坐标值），并输入颜色计算模式后软件可以自动根据公式计算各个点的颜色响应值，并绘制在图表中。在各个采样区内将会随机选取10个数据点计算，并以平均值为响应，同时记录标准差；`随机采样种子`可以在`采样`设置区域自定义，默认种子为`42`。
其中`采样列表`部分设置的编号为绘图时各个数据点数值的横坐标，仅在输入数字条件下可以使用散点图并自动线性回归；`回归`部分中的`权重`为选择散点图自动拟合过程中对各点误差处理方法，其中`直接权重`表示各点的拟合权重为1/标准差，`仪器权重`表示各点拟合权重为1/e^标准差。
<center>
<a href='src/docs/tools/fl/img/5.png' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/5.png' style="max-width:100%;max-height:240px">

<a href='src/docs/tools/fl/img/6.png' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/6.png' style="max-width:100%;max-height:240px">
</a>
</center>

<a href='src/docs/tools/fl/example/example.zip'>***点击此处***</a>可以下载示例数据，体验处理流程。

---

## 常见问题

### 为什么我的图像自动识别裁切不正确
目前软件功能有限，自动识别需要较为干净的背景和完整的模板图片，如果模板裁切较大、待处理图像背景复杂、待处理图像方向不正确（旋转角度过大）等都可能导致自动识别不准确。若仍希望使用自动识别拼接，建议先对待处理图像简单裁切以去除复杂背景。

### 为什么自动裁切这么慢
受到浏览器性能限制，自动识别目前只能逐张进行，且暂时无法发挥设备全部性能。


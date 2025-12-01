from pathlib import Path


def replace_in_file(path_str: str, replacements: list[tuple[str, str]]):
    path = Path(path_str)
    text = path.read_text(encoding="utf-8")
    for old, new in replacements:
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


replace_in_file(
    "src/components/fl-image-processor/ImageMerge.vue",
    [
        (
            '<span class="drag-handle">↕</span>',
            '<span class="drag-handle" :title="t(\'imageMerge.dragHandle\')" :aria-label="t(\'imageMerge.dragHandle\')">::</span>',
        ),
    ],
)

replace_in_file(
    "src/components/fl-image-processor/ImageRegression.vue",
    [
        (
            "formatter: (params: any) => `��${params.value?.[2] ?? 0}`",
            "formatter: (params: any) => t('imageRegression.chart.tooltipStd', { value: params.value?.[2] ?? 0 })",
        ),
        (
            "title: { text: 'No data', left: 'center' },",
            "title: { text: t('imageRegression.chart.noData'), left: 'center' },",
        ),
        (
            "xAxis: { type: 'value', name: 'Number' },",
            "xAxis: { type: 'value', name: t('imageRegression.chart.numberAxis') },",
        ),
        (
            "yAxis: { type: 'value', name: 'Result' },",
            "yAxis: { type: 'value', name: t('imageRegression.chart.resultAxis') },",
        ),
        (
            "name: 'Data points',",
            "name: t('imageRegression.chart.dataPoints'),",
        ),
        (
            "name: `Regression (R2 = ${regression.rSquared.toFixed(4)})`",
            "name: t('imageRegression.chart.regression', { value: regression.rSquared.toFixed(4) })",
        ),
        (
            "name: 'Values',",
            "name: t('imageRegression.chart.values'),",
        ),
        (
            "text: plotType.value === 'scatter' ? 'Linear regression' : 'Data distribution',",
            "text: plotType.value === 'scatter' ? t('imageRegression.chart.linearRegression') : t('imageRegression.chart.dataDistribution'),",
        ),
        (
            "? { type: 'value', name: 'Number' }",
            "? { type: 'value', name: t('imageRegression.chart.numberAxis') }",
        ),
        (
            ": { type: 'category', name: 'Number', data: xVals.map((v) => String(v)) },",
            ": { type: 'category', name: t('imageRegression.chart.numberAxis'), data: xVals.map((v) => String(v)) },",
        ),
        (
            "yAxis: { type: 'value', name: 'Result' },",
            "yAxis: { type: 'value', name: t('imageRegression.chart.resultAxis') },",
        ),
    ],
)

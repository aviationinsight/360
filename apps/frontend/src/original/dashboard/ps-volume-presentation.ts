export const psVolumePresentation = `
*{box-sizing:border-box}
html,body{margin:0!important;width:1920px!important;height:1080px!important;overflow:hidden!important}
.ps-dashboard{display:block!important;width:1920px!important;height:1080px!important;min-height:0!important;background:#f7f8fb!important;font-family:Inter,sans-serif!important}
.ps-sidebar,.ps-live,.ps-empty,.ps-footer{display:none!important}
.ps-main{display:grid!important;grid-template-rows:54px 144px 432px 354px!important;gap:16px!important;padding:24px!important;width:1920px!important;max-width:none!important;height:1080px!important;margin:0!important;overflow:hidden!important}
.ps-heading{margin:0!important;align-items:center!important}.ps-heading h2{font-size:26px!important;font-weight:700!important;margin:0 0 5px!important}.ps-heading .ps-eyebrow{display:none!important}.ps-heading p{font-size:16px!important;margin:0!important;font-weight:600!important}
.ps-kpis{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:18px!important;margin:0!important;height:144px!important}
.ps-kpi{padding:16px 22px!important;border-radius:14px!important;box-shadow:none!important}.ps-kpi>div{font-size:18px!important;font-weight:700!important}.ps-kpi strong{font-size:44px!important;line-height:1.15!important;margin:10px 0 7px!important}.ps-kpi small{font-size:16px!important;line-height:1.3!important}.ps-kpi svg{width:23px!important;height:23px!important}
.ps-summary-row{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px!important;margin:0!important;height:432px!important}
.ps-comparisons{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px!important;min-width:0!important;height:432px!important}
.ps-panel{padding:18px 16px!important;margin:0!important;box-shadow:none!important;min-width:0!important;overflow:hidden!important}
.ps-panel-title{margin:0 0 10px!important;gap:6px!important}.ps-panel-title h3{font-size:20px!important;font-weight:800!important;line-height:1.2!important}.ps-panel-title>span{font-size:10px!important;letter-spacing:.8px!important}
.ps-summary-row .ps-panel-title{min-height:48px!important;display:flex!important;flex-direction:column!important}
.ps-legend{font-size:13px!important;gap:16px!important;min-height:20px!important}.ps-dot{width:10px!important;height:10px!important}
.ps-chart{width:100%!important;height:306px!important;max-height:none!important;margin:10px 0 0!important}.ps-chart text{font-size:11px!important}
.ps-distribution table{width:100%!important;font-size:16px!important;table-layout:auto!important}.ps-distribution th,.ps-distribution td{padding:8px!important;line-height:1.25!important;height:32px!important}.ps-distribution thead th{font-size:13px!important;font-weight:700!important;white-space:normal!important}.ps-share{padding:3px 6px!important}.ps-table-scroll{overflow:visible!important}
.ps-trend-panel{height:354px!important;padding:16px 20px!important;overflow:hidden!important}.ps-trend-panel .ps-panel-title{margin-bottom:6px!important}.ps-trend-sub{height:20px!important;align-items:center!important}.ps-trend-sub p{font-size:12px!important}.ps-trend{width:100%!important;min-width:0!important;height:266px!important;max-height:none!important;margin:4px 0 0!important}.ps-trend text{font-size:12px!important}.ps-trend text.ps-point-label{font-size:13px!important;font-weight:800!important}
.ps-footer{padding:0!important;font-size:9px!important;line-height:16px!important}
*,*::before,*::after{animation:none!important;transition:none!important}
`;

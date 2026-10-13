/* Coordinates follow the existing, cropped method figure exactly.
 * Artwork: 2400 × 1118. Overlay design space: 2048 × 954.026667.
 * Existing static primitives are masked and redrawn as animated SVG elements.
 * Text, photographs, module positions and final supervision weights stay intact.
 */
window.LoopWAMMethodConfig = {
  width: 2400,
  height: 1118,
  overlayWidth: 2048,
  // Rounded surfaces retained by images/method.svg. Everything around them is transparent.
  // [x, y, width, height, corner radius], in the same 2048-wide design space.
  artworkPanels: [
    [4.5,3.7,611.3,522.5,7], [657.3,95,730,338.3,6.7],
    [1430.5,8.8,611.2,517.4,6.6], [4.5,566.9,2037.3,380.9,5.3],
    [656.5,8,222.2,52.2,11.6], [885.2,8,275.9,52.3,13.5],
    [1168.5,8,217.1,51.4,12.5], [722.2,473.9,230.7,53.2,13.6],
    [1111.3,477.3,216.2,51.5,12.5]
  ],
  speed: 1,
  // One shared cycle keeps connected paths in the same phase.
  flowCycle: {seconds:9.6, fadeAt:8.8, fadeDuration:.6, durationScale:1.5},
  colors: {
    teal: '#009fa9', green: '#04ba92', video: '#37a5df',
    action: '#f2ae30', purple: '#a473e5', coral: '#f58470',
    ink: '#505660', connector: '#80858c'
  },
  // [name, SVG path, color key, drawing seconds, start within the shared cycle]
  flows: [
    ['expert-timeline', 'M102 166 H490', 'teal', 1.55, 0],
    ['data-input', 'M615 203 H734', 'teal', .8, .65],
    ['observation-input', 'M772 60 V95', 'green', .45, .5],
    ['video-input', 'M1021 60 V95', 'video', .45, .6],
    ['action-input', 'M1273 60 V95', 'action', .45, .7],
    ['suboptimal-fork', 'M168 405 Q187 392 205 382 Q225 373 244 369', 'action', .8, .2],
    ['failure-fork', 'M168 415 Q188 432 205 442 Q225 454 246 459', 'coral', .8, .38],
    ['state-cross-attention', 'M865 201 V236 H1023', 'connector', .95, 1.1],
    ['text-cross-attention', 'M1181 201 V236 H1023', 'connector', .95, 1.1],
    ['shared-cross-attention', 'M1023 236 V339', 'connector', .65, 2.05],
    ['video-output', 'M834 432 V473', 'video', .55, 3],
    ['action-output', 'M1213 432 V474', 'action', .55, 3],
    ['quality-to-text', 'M1495 203 H1310', 'purple', 1, .65],
    ['inference-quality', 'M1899 383 Q1952 379 1980 342', 'purple', .95, 3.6],
    ['inference-trajectory', 'M1876 480 Q1896 466 1917 456 Q1941 447 1964 455 L1995 444', 'purple', 1.4, 4.15],
    ['rollout-to-quality', 'M1674 695 H1738', 'ink', .55, 4.3],
    ['annotation-feedback', 'M1907 695 H1958 V528', 'purple', 1.65, 4.85],
    ['action-trajectory', 'M1145 684 Q1161 671 1170 671 C1190 680 1207 692 1226 686 Q1245 687 1260 673', 'action', 1.1, 3.65]
  ],
  // [x, y, original radius, color key, phase offset in seconds]
  nodes: [
    [102,166,7,'green',0], [230,166,7,'green',.65], [355,166,7,'green',1.3],
    [205,382,6.3,'action',1.1], [205,442,6.3,'coral',2],
    [1530,286,10.5,'purple',0], [1586,286,10.5,'purple',.25],
    [1611,286,10.5,'purple',.45], [1678,286,10.5,'purple',.7],
    [1689,286,10.5,'purple',.85], [1740,286,10.5,'purple',1.1],
    [1778,286,10.5,'purple',1.35], [1807,286,10.5,'purple',1.55],
    [1853,286,10.5,'purple',1.8], [1907,286,10.5,'purple',2.05],
    [1938,286,10.5,'purple',2.25], [1993,286,15,'purple',2.7],
    [1876,480,6.8,'video',1.8], [1917,456,7,'video',2.2], [1964,455,7,'video',2.65],
    [1145,684,4.6,'action',0], [1170,671,4.6,'action',.4],
    [1226,686,4.6,'action',.8], [1260,673,4.6,'action',1.2]
  ],
  // Curves draw progressively; supervision highlights sweep across fixed weights.
  curves: [
    ['expert-video-noise', 'M145 726 C290.5 726 324.3 731 371 669', 'video', 1.6, .45],
    ['expert-action-noise', 'M411 725 C495 722 582 707 648 675', 'action', 1.6, .65],
    ['rollout-video-noise', 'M145 826 C230 824 308 808 371 781', 'video', 1.6, 1.35],
    ['rollout-action-noise', 'M411 775 C457.5 833 497 826.1 648 828', 'action', 1.6, 1.55]
  ],
  tokens: [
    [754,157,30,31,'green',0], [792,157,30,31,'green',.22],
    [831,157,30,31,'green',.44], [931,158,29,31,'green',.66], [969,158,30,31,'green',.88],
    [1042,158,31,31,'purple',.6], [1077,158,31,31,'purple',.82],
    [1113,158,31,31,'purple',1.04], [1214,158,30,31,'purple',1.26], [1253,158,30,31,'purple',1.48]
  ],
  bars: [
    [920,711,157,27,'video',0], [920,757,157,27,'video',.4], [920,802,157,27,'video',.8],
    [1128,711,157,27,'action',.2], [1128,757,86,27,'action',.6]
  ],
  stars: [[502,164,15,'green',0], [2005,442,14,'purple',2.7], [1997,753,13,'green',1.8]],
  annotationTokens: [
    [1654,755,42,41,'video',0], [1654,801,42,41,'video',.6], [1654,847,42,41,'video',1.2],
    [1951,751,40,37,'green',1.8], [1951,820,40,37,'coral',2.4]
  ],
  // Match the reference pixels exposed by the SVG erasure mask.
  backgrounds: [
    [657.3,95,730,338.3,'#fff'],
    [7,7,606,517,'#f2fafa'], [742,113,280,88,'#f7fcf6'],
    [1022,113,274,88,'#f6effd'], [686,250,324,155,'#eef8ff'],
    [1037,250,324,155,'#fff8ee'], [1433,12,606,512,'#faf9fd'],
    [7,571,2032,373,'#fefaf4'], [29,588,649,327,'#fffffa'],
    [697,588,662,327,'#fffffa'], [1375,588,649,327,'#fffffa']
  ],
  // [name, polygon of the original fixed arrowhead].
  arrowheads: {
    'data-input':'717,190.5 737,202.3 717,214',
    'observation-input':'762,78 782,78 775,95.5 769,95.5',
    'video-input':'1011,78 1031,78 1024,95.5 1018,95.5',
    'action-input':'1264,79 1282,79 1273,96',
    'video-output':'826,458 842,458 834,475',
    'action-output':'1204,457 1223,457 1213.5,475',
    'quality-to-text':'1327,193 1310,203 1327,213',
    'inference-quality':'1958.5,344.5 1982,339.5 1974,362.5',
    'rollout-to-quality':'1720,682.5 1740,694.5 1720,706.5',
    'annotation-feedback':'1945.5,546 1957.5,527 1969,546'
  },
  // Fixed terminal arrowheads: [length, half-width], matching each original shape.
  arrowSizes: {
    'data-input':[17,10], 'quality-to-text':[17,10],
    'observation-input':[16,8], 'video-input':[16,8], 'action-input':[16,8],
    'video-output':[15,7.5], 'action-output':[15,7.5],
    'inference-quality':[16,8], 'rollout-to-quality':[17,10],
    'annotation-feedback':[17,10]
  },
  // The masked arrows cross these existing borders; restore the borders first.
  repairs: [
    ['M614 195 V211','#14b68d',3], ['M659 195 V211','#83add2',3],
    ['M1385 195 V211','#83add2',3], ['M1432 195 V211','#b78ce2',3],
    ['M1949 570 H1967','#f6ab32',3],
    ['M824 431 H844','#83add2',3], ['M1203 431 H1223','#83add2',3],
    ['M760 97.3 H784','#83add2',3.4], ['M1009 97.3 H1033','#83add2',3.4],
    ['M860 201 H870','#7bbb9f',1], ['M1176 201 H1186','#b78ce2',1],
    ['M1017 339 H1029','#484848',1.6],
    ['M144 665 V727 H371 V732','#344872',1],
    ['M410 665 V727 H648 V732','#344872',1],
    ['M144 771 V828 H371 V833','#344872',1],
    ['M410 771 V828 H648 V833','#344872',1],
    ['M1476.5 262 C1474.7 266 1473.8 271 1473.8 276','#a16ddf',1.8],
    ['M2004.8 262 C2006.8 266 2008.2 271 2008.7 276','#a16ddf',1.8]
  ],
  // Existing photographs receive a sequential border accent, not synthetic video.
  frameAccents: [[62,184,121,70],[191,184,121,70],[316,184,121,70],[444,184,121,70]],
  branchAccents: [[686,250,324,155,'video',0],[1037,250,324,155,'action',.6]],
  // Original card, including its border, composited above both branch accents.
  jointForeground: {x:776,y:337.3,width:487,height:48.3,rx:6},
  qualityBar: {x:1473,y:275,width:537,height:23}
};

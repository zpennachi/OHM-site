export const swirlVertexShader = `
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const swirlFragmentShader = `
  precision mediump float;
  precision mediump int;

  varying vec3 vWorldPos;

  uniform float uTime;
  uniform float uScale;
  uniform float uBrightness;
  uniform float uOpacity;
  uniform float uDepth;
  uniform float uDistortion;
  uniform float uSpeed;
  uniform vec3  uCameraPos;

  const float PI = 3.14159265;

  vec3 hsb2rgb(in vec3 c){
    vec3 rgb = clamp(
      abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
      0.0,
      1.0
    );
    rgb = rgb * rgb * (3.0 - 2.0 * rgb);
    return c.z * mix(vec3(.5), rgb, c.y);
  }

  float hash(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p.x + p.y + p.z) * 43758.5453123);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);

    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);

    return mix(nxy0, nxy1, f.z);
  }

  vec3 sampleRainbow(vec3 pos) {
    vec3 p = pos * uScale;
    float angle = atan(p.z, p.x);
    float radius = length(p.xy);
    float base = radius * .01 - uTime * uSpeed;
    float n = noise3D(p * 0.2 + uTime * 0.1) * uDistortion;
    float swirl = sin(base + n) * 0.1 + 0.5;
    float hue = fract(angle / (2.0 * PI) + p.y * 0.5 + n * 0.1 + uTime * 0.2);
    float sat = 0.5 + 0.1 * swirl;
    float val = mix(0.25, uBrightness, swirl);
    return hsb2rgb(vec3(hue, sat, val));
  }

  void main() {
    vec3 viewDir = normalize(vWorldPos - uCameraPos);

    vec3 accum = vec3(0.0);
    float accumW = 0.0;

    const int STEPS = 3;

    for (int i = 0; i < STEPS; i++) {
      float tIn = float(i) / float(STEPS - 1);
      float offset = (tIn - 0.5) * uDepth;
      vec3 samplePos = vWorldPos - viewDir * offset;

      vec3 c = sampleRainbow(samplePos);
      float w = mix(2.0, 0.35, tIn);

      accum += c * w;
      accumW += w;
    }

    vec3 color = accum / max(accumW, 0.0001);
    gl_FragColor = vec4(color, uOpacity);
  }
`;

export const bgVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const bgFragmentShader = `
  precision mediump float;
  precision mediump int;

  varying vec2 vUv;

  uniform sampler2D uTexCurrent;
  uniform sampler2D uTexNext;
  uniform float uMix;
  uniform float uTime;

  float hash(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p.x + p.y + p.z) * 43758.5453123);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);

    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);

    return mix(nxy0, nxy1, f.z);
  }

  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 2; i++) {
      sum += amp * noise3D(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    vec4 c1 = texture2D(uTexCurrent, vUv);
    vec4 c2 = texture2D(uTexNext, vUv);
    vec4 baseTex = mix(c1, c2, uMix);

    vec2 centered = vUv - 0.5;
    float r = length(centered);

    float centerRadius = 0.1;
    float outerRadius = 0.48;

    vec3 p = vec3(vUv * 5.0, uTime * 0.2);
    float n = fbm(p);
    float clouds = smoothstep(0.1, .6, n);

    float radial = 1.0 - smoothstep(centerRadius, outerRadius, r);
    float center = .1 - smoothstep(centerRadius * .000075, centerRadius, r);

    float mask = max(clouds * radial, center);
    mask = clamp(mask, 0.0, 2.0);

    float shaped = pow(mask, 1.1);
    float minDark = 0.007;
    float brightness = mix(minDark, 1.0, shaped);

    vec3 color = baseTex.rgb * brightness * .9;
    gl_FragColor = vec4(color, baseTex.a);
  }
`;

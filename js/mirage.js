// Animated "mirage" background: a soft, grainy ribbon of colour drifting
// across the screen, drawn with a tiny WebGL shader (no libraries, no video).
// Falls back to the static CSS gradient on <body> if WebGL is unavailable.
(function () {
    const canvas = document.querySelector('.mirage');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const vertexSource = `
        attribute vec2 position;
        void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `;

    const fragmentSource = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif

        uniform vec2 resolution;
        uniform float time;

        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / resolution;
            float aspect = resolution.x / resolution.y;
            float portrait = clamp(1.0 / aspect, 1.0, 2.2);
            float t = time;

            // The ribbon behaves like silk in a breeze: waves roll along its
            // length while its thickness swells and pinches independently.
            float x = uv.x;
            float centre = 0.47 + 0.24 * (x - 0.5) / portrait
                + 0.065 * sin(x * 2.2 - t * 0.42)
                + 0.040 * sin(x * 1.3 + t * 0.27 + 1.7)
                + 0.025 * sin(x * 4.3 + t * 0.61 + 0.6);

            float swell = 0.5 + 0.5 * sin(x * 2.7 + t * 0.47 + 2.0);
            float pinch = 0.55 + 0.45 * sin(x * 1.6 - t * 0.31 + 0.4);
            float half_width = (0.045 + 0.095 * sqrt(swell * pinch)) / pow(portrait, 0.15);

            float d = uv.y - centre;

            // Colour across the ribbon: sky blue on top, lilac, then salmon.
            float k = clamp(0.5 - 0.5 * d / half_width, 0.0, 1.0);
            vec3 blue   = vec3(0.55, 0.72, 0.98);
            vec3 lilac  = vec3(0.83, 0.62, 0.94);
            vec3 salmon = vec3(1.00, 0.66, 0.60);
            vec3 colour = mix(blue, lilac, smoothstep(0.08, 0.45, k));
            colour = mix(colour, salmon, smoothstep(0.58, 0.95, k));

            // Faint silky striations running along the ribbon.
            colour += 0.012 * (noise(vec2(x * 1.5 + t * 0.05, k * 14.0)) - 0.5);

            // Soft edges: wide ribbons blur out further than thin ones,
            // and the blue top dissolves more gently than the salmon bottom.
            float fadeTop = 0.05 + 0.9 * half_width;
            float fadeBottom = 0.04 + 0.6 * half_width;
            float edge = d > 0.0
                ? 1.0 - smoothstep(half_width * 0.75, half_width + fadeTop, d)
                : 1.0 - smoothstep(half_width * 0.8, half_width + fadeBottom, -d);

            vec3 background = vec3(0.937, 0.933, 0.925);
            vec3 c = mix(background, colour, edge * 0.95);

            // Fine, subtle grain, mostly within the ribbon
            // (fixed to the pixel grid so it doesn't flicker).
            c += (hash(gl_FragCoord.xy) - 0.5) * (0.012 + 0.03 * edge);

            gl_FragColor = vec4(c, 1.0);
        }
    `;

    function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    }

    const vs = compile(gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'resolution');
    const uTime = gl.getUniformLocation(program, 'time');

    // Render at the screen's real pixel density (up to 2x) so the grain stays
    // fine instead of being stretched into visible specks.
    function resize() {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(canvas.clientWidth * ratio);
        const height = Math.round(canvas.clientHeight * ratio);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
        }
        gl.uniform2f(uResolution, width, height);
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const start = performance.now();
    const offset = 20; // start mid-drift rather than at t = 0

    function draw(now) {
        resize();
        gl.uniform1f(uTime, offset + (now - start) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now) {
        draw(now);
        if (!reduceMotion.matches) requestAnimationFrame(loop);
    }

    window.addEventListener('resize', () => {
        if (reduceMotion.matches) draw(performance.now());
    });
    reduceMotion.addEventListener('change', () => requestAnimationFrame(loop));

    requestAnimationFrame((now) => {
        loop(now);
        canvas.classList.add('is-ready');
    });
})();

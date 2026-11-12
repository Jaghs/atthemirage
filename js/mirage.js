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

            // Centre line of the ribbon: rises left to right and slowly undulates.
            float x = uv.x;
            float centre = 0.47 + 0.30 * (x - 0.5) / portrait
                + 0.055 * sin(x * 2.4 + t * 0.21)
                + 0.035 * sin(x * 5.3 - t * 0.17)
                + 0.08 * (noise(vec2(x * 1.6 + t * 0.05, t * 0.04)) - 0.5);

            // Thickness breathes along its length.
            float width = (0.20 + 0.05 * sin(x * 3.1 - t * 0.13)) / pow(portrait, 0.15);

            // Position across the ribbon: +1 at the top edge, -1 at the bottom edge,
            // with a little turbulence so the bands of colour feel liquid.
            float s = (uv.y - centre) / width;
            s += 0.18 * (noise(uv * vec2(3.0 * aspect, 3.0) + t * 0.06) - 0.5);

            vec3 blue  = vec3(0.47, 0.66, 1.00);
            vec3 lilac = vec3(0.80, 0.62, 0.98);
            vec3 pink  = vec3(1.00, 0.66, 0.79);
            vec3 peach = vec3(1.00, 0.73, 0.58);

            float k = clamp(0.5 - 0.5 * s, 0.0, 1.0);
            vec3 colour = mix(blue, lilac, smoothstep(0.05, 0.40, k));
            colour = mix(colour, pink, smoothstep(0.35, 0.65, k));
            colour = mix(colour, peach, smoothstep(0.62, 0.95, k));

            // Soft edges: the top fades out gently, the bottom a little sooner.
            float edge = s > 0.0 ? smoothstep(1.25, 0.15, s) : smoothstep(-1.1, -0.2, s);

            vec3 background = vec3(0.937, 0.933, 0.925);
            vec3 c = mix(background, colour, edge * 0.92);

            // Film grain (fixed to the pixel grid so it doesn't flicker).
            c += (hash(gl_FragCoord.xy) - 0.5) * 0.075;

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

    // The ribbon is soft, so it doesn't need retina resolution; capping the
    // pixel ratio keeps the grain crisp-ish while sparing phone batteries.
    function resize() {
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
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

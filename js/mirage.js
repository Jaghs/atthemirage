// Animated "mirage" background: a soft, grainy ribbon of colour drifting
// across the screen, drawn with a tiny WebGL shader (no libraries, no video).
// Falls back to the static CSS gradient on <body> if WebGL is unavailable.
(function () {
    const canvas = document.querySelector('.mirage');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) {
        console.warn('mirage: WebGL unavailable, showing the still background');
        return;
    }

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
        uniform float night; // 0 = day palette, 1 = night palette

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
            float centre = 0.48 + 0.40 * (x - 0.5) / portrait
                + 0.090 * sin(x * 2.2 - t * 0.42)
                + 0.055 * sin(x * 1.3 + t * 0.27 + 1.7)
                + 0.025 * sin(x * 4.3 + t * 0.61 + 0.6);

            float swell = 0.5 + 0.5 * sin(x * 2.7 + t * 0.47 + 2.0);
            float pinch = 0.55 + 0.45 * sin(x * 1.6 - t * 0.31 + 0.4);
            float half_width = (0.09 + 0.14 * sqrt(swell * pinch)) / pow(portrait, 0.15);

            float d = uv.y - centre;

            // Colour across the ribbon, like a desert sky at dusk:
            // dusty lavender above, rose, amber, then a deep red at the horizon.
            // Position across the ribbon for colouring. The colour bands get a minimum
            // width so that where the ribbon pinches, ember and crimson can't squeeze
            // into a sharp line; and k isn't clamped, so the blends ease out smoothly.
            float k = 0.5 - 0.5 * d / max(half_width, 0.11);
            // At night: deep indigo, plum, ember and a deeper ember over a black sky.
            // The last colour stays close to the ember so the ribbon doesn't darken
            // and fade to black at the same time, which made a sharp moving edge.
            vec3 lavender = mix(vec3(0.72, 0.67, 0.89), vec3(0.30, 0.26, 0.60), night);
            vec3 rose     = mix(vec3(0.93, 0.63, 0.71), vec3(0.58, 0.27, 0.55), night);
            vec3 amber    = mix(vec3(0.98, 0.75, 0.52), vec3(0.92, 0.45, 0.32), night);
            vec3 red      = mix(vec3(0.91, 0.47, 0.40), vec3(0.80, 0.33, 0.27), night);

            // Long, overlapping blends so no colour has a visible start or stop.
            vec3 colour = mix(lavender, rose, smoothstep(-0.1, 0.45, k));
            colour = mix(colour, amber, smoothstep(0.25, 0.80, k));
            colour = mix(colour, red, smoothstep(0.65, 1.20, k));

            // Faint silky striations running along the ribbon.
            colour += 0.012 * (1.0 - night) * (noise(vec2(x * 1.5 + t * 0.05, clamp(k, -0.5, 1.5) * 14.0)) - 0.5);

            // Soft edges: wide ribbons blur out further than thin ones,
            // and the blue top dissolves more gently than the salmon bottom.
            // At night the fades start earlier and run longer, since a bright colour
            // dissolving into black shows every step.
            float fadeTop = 0.12 + 0.06 * night + 1.2 * half_width;
            float fadeBottom = 0.10 + 0.14 * night + 1.0 * half_width;
            float edge = d > 0.0
                ? 1.0 - smoothstep(half_width * 0.2, half_width + fadeTop, d)
                : 1.0 - smoothstep(half_width * 0.3 * (1.0 - night), half_width + fadeBottom, -d);
            edge = edge * edge * (3.0 - 2.0 * edge);

            vec3 background = mix(vec3(0.945, 0.937, 0.925), vec3(0.0), night); // true black at night for OLED
            vec3 c = mix(background, colour, edge * 0.95);

            // Fine, subtle grain, mostly within the ribbon (fixed to the pixel grid so
            // it doesn't flicker). At night the empty sky gets none, so it stays pure black.
            c += (hash(gl_FragCoord.xy) - 0.5) * (0.012 * (1.0 - night) + 0.03 * edge);
            c = max(c, 0.0);

            gl_FragColor = vec4(c, 1.0);
        }
    `;

    function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
        console.warn('mirage: shader failed to compile', gl.getShaderInfoLog(shader));
        return null;
    }

    const vs = compile(gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('mirage: shader failed to link', gl.getProgramInfoLog(program));
        return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'resolution');
    const uTime = gl.getUniformLocation(program, 'time');
    const uNight = gl.getUniformLocation(program, 'night');

    // Fade smoothly between the day and night palettes when the theme changes.
    const isDark = () => document.documentElement.dataset.theme === 'dark';
    let night = isDark() ? 1 : 0;

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

    let time = 20; // start mid-drift rather than at t = 0
    let last = null;

    function loop(now) {
        const dt = last === null ? 0 : Math.min(now - last, 100) / 1000;
        time += dt;
        last = now;
        night += ((isDark() ? 1 : 0) - night) * Math.min(1, dt * 3);
        resize();
        gl.uniform1f(uTime, time);
        gl.uniform1f(uNight, night);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        requestAnimationFrame(loop);
    }

    requestAnimationFrame((now) => {
        loop(now);
        canvas.classList.add('is-ready');
        console.info('mirage: animating');
    });
})();

// Animated "mirage" background: a soft, grainy ribbon of colour drifting
// across the screen, drawn with a tiny WebGL shader (no libraries, no video).
// Falls back to a still CSS gradient (see .no-webgl in styles.css) if WebGL is
// unavailable; the still gradient is never shown otherwise, so it can't flash.
(function () {
    const canvas = document.querySelector('.mirage');
    const fallBack = () => document.documentElement.classList.add('no-webgl');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) {
        console.warn('mirage: WebGL unavailable, showing the still background');
        fallBack();
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
        uniform float night;  // 0 = day palette, 1 = night palette
        uniform float bloom;  // 0 = a tight band behind the title, 1 = filling the screen
        uniform float anchor; // height of the title's centre (0 = bottom, 1 = top)

        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        // Like smoothstep, but its curvature also eases in and out, so the start and
        // end of a blend leave no visible line.
        float ease(float a, float b, float x) {
            float t = clamp((x - a) / (b - a), 0.0, 1.0);
            return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
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
            // At rest it lies close behind the title; on "enter" it blooms outward.
            float b = bloom * bloom * (3.0 - 2.0 * bloom);
            float x = uv.x;
            float waves = mix(0.5, 1.0, b);
            float centre = mix(anchor, 0.48, b) + mix(0.14, 0.40, b) * (x - 0.5) / portrait
                + waves * (0.090 * sin(x * 2.2 - t * 0.42)
                         + 0.055 * sin(x * 1.3 + t * 0.27 + 1.7)
                         + 0.025 * sin(x * 4.3 + t * 0.61 + 0.6));

            float swell = 0.5 + 0.5 * sin(x * 2.7 + t * 0.47 + 2.0);
            float pinch = 0.55 + 0.45 * sin(x * 1.6 - t * 0.31 + 0.4);
            // (Kept smooth on purpose: an earlier sqrt() here creased the ribbon into a
            // thin line that travelled right to left whenever the swell bottomed out.)
            float shape = mix(0.25, 1.0, swell) * pinch;
            float half_width = mix(0.075 + 0.10 * shape, 0.10 + 0.19 * shape, b) / pow(portrait, 0.15);

            float d = uv.y - centre;

            // Every curve below is smooth all the way through, with no point where an
            // easing starts or stops. On a black sky the eye picks out any such point
            // as a faint line that slides along with the ribbon.

            // Position across the ribbon for colouring (0 = top, 1 = bottom), with a
            // smooth minimum width so the colours never squeeze together where it pinches.
            float k = 0.5 - 0.5 * d / sqrt(half_width * half_width + 0.011);

            // Day: a desert sky at dusk, dusty lavender, rose, amber, then a soft red.
            // Night: deep indigo, plum, ember and a deeper ember over a black sky.
            vec3 lavender = mix(vec3(0.72, 0.67, 0.89), vec3(0.30, 0.26, 0.60), night);
            vec3 rose     = mix(vec3(0.93, 0.63, 0.71), vec3(0.58, 0.27, 0.55), night);
            vec3 amber    = mix(vec3(0.98, 0.75, 0.52), vec3(0.92, 0.45, 0.32), night);
            vec3 red      = mix(vec3(0.91, 0.47, 0.40), vec3(0.80, 0.33, 0.27), night);

            vec3 colour = mix(lavender, rose, ease(-0.1, 0.45, k));
            colour = mix(colour, amber, ease(0.25, 0.80, k));
            colour = mix(colour, red, ease(0.65, 1.20, k));

            // Faint silky striations running along the ribbon (daytime only).
            colour += 0.012 * (1.0 - night) * (noise(vec2(x * 1.5 + t * 0.05, clamp(k, -0.5, 1.5) * 14.0)) - 0.5);

            // How strongly the ribbon shows: a soft glow, full in the middle and dying
            // away smoothly. The top dissolves a little more gently than the bottom,
            // and at night both glow out further.
            float spreadTop = mix(0.07, 0.07 + 0.05 * night, b) + 1.3 * half_width;
            float spreadBottom = mix(0.06, 0.06 + 0.05 * night, b) + 1.2 * half_width;
            float above = 1.0 / (1.0 + exp(-d / 0.04));
            float u = d / mix(spreadBottom, spreadTop, above);
            float edge = exp(-u * u * (0.6 + 0.4 * u * u));

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
    if (!vs || !fs) {
        fallBack();
        return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('mirage: shader failed to link', gl.getProgramInfoLog(program));
        fallBack();
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
    const uBloom = gl.getUniformLocation(program, 'bloom');
    const uAnchor = gl.getUniformLocation(program, 'anchor');

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

    // Pages without a title (the gallery) start fully bloomed. Arriving from the
    // splash page, pick up the ribbon exactly where it was so the motion carries on.
    const title = document.querySelector('.title');
    let bloom = title ? 0 : 1;
    let bloomTween = null;
    let time = 20; // start mid-drift rather than at t = 0
    let continuing = false;
    try {
        const handoff = JSON.parse(sessionStorage.getItem('mirage') || 'null');
        sessionStorage.removeItem('mirage');
        if (handoff && !title) {
            time = handoff.time;
            continuing = true;
        }
    } catch (e) {}
    let last = null;

    function anchorHeight() {
        if (!title) return 0.5;
        const rect = title.getBoundingClientRect();
        return 1 - (rect.top + rect.height / 2) / window.innerHeight;
    }

    function easeInOut(p) {
        return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    }

    function draw(now) {
        const dt = last === null ? 0 : Math.min(now - last, 100) / 1000;
        time += dt;
        last = now;
        night += ((isDark() ? 1 : 0) - night) * Math.min(1, dt * 3);
        if (bloomTween) {
            const p = Math.min(1, (now - bloomTween.start) / bloomTween.duration);
            bloom = bloomTween.from + (bloomTween.to - bloomTween.from) * easeInOut(p);
            if (p === 1) {
                bloomTween.done();
                bloomTween = null;
            }
        }
        resize();
        gl.uniform1f(uTime, time);
        gl.uniform1f(uNight, night);
        gl.uniform1f(uBloom, bloom);
        gl.uniform1f(uAnchor, anchorHeight());
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Paused while something covers the whole screen (an open photo), to save battery.
    let paused = false;

    function loop(now) {
        if (paused) last = now;
        else draw(now);
        requestAnimationFrame(loop);
    }

    // Used by the enter button: bloom the ribbon out (or back), then resolve.
    window.mirage = {
        bloomTo(to, duration) {
            return new Promise((done) => {
                bloomTween = { from: bloom, to, duration, start: performance.now(), done };
            });
        },
        reset() {
            bloomTween = null;
            bloom = title ? 0 : 1;
        },
        handoff() {
            try { sessionStorage.setItem('mirage', JSON.stringify({ time })); } catch (e) {}
        },
        pause(value) {
            paused = value;
        },
    };

    // Draw the first frame straight away, before the page is first shown. Arriving
    // from the splash page, show it instantly so the ribbon simply carries on;
    // otherwise fade it in.
    draw(performance.now());
    if (continuing) canvas.classList.add('is-continuing');
    requestAnimationFrame(() => canvas.classList.add('is-ready'));
    requestAnimationFrame(loop);
    console.info('mirage: animating');
})();

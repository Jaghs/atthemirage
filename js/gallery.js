// The gallery: an endless wall of photos you can drag in any direction. Clicking
// a photo flies it into a large view with its details beside it (below it on
// phones); clicking the large photo zooms in, and the zoom follows the mouse.
(function () {
    const photos = window.PHOTOS || [];
    if (!photos.length) return;

    const wall = document.querySelector('.wall');
    const plane = wall.querySelector('.wall-plane');
    const hint = document.querySelector('.wall-hint');
    const viewer = document.querySelector('.viewer');
    const stage = viewer.querySelector('.viewer-stage');
    const viewImg = viewer.querySelector('.viewer-img');
    const strip = viewer.querySelector('.viewer-strip');
    const heading = viewer.querySelector('.viewer-heading');
    const foot = viewer.querySelector('.viewer-foot');
    const metaEl = viewer.querySelector('.viewer-meta');
    const titleEl = viewer.querySelector('.viewer-title');
    const specsEl = viewer.querySelector('.viewer-specs');
    const countEl = viewer.querySelector('.viewer-count');
    const closeButton = viewer.querySelector('.viewer-close');
    const phone = window.matchMedia('(max-width: 760px)');
    const N = photos.length;

    const mod = (a, n) => ((a % n) + n) % n;

    // ------------------------------------------------------------------ wall

    let cellW = 0, cellH = 0, boxW = 0, boxH = 0;
    let cols = 0, rows = 0;
    let tiles = [];
    let offX = 0, offY = 0;
    let velX = 0, velY = 0;
    let dirty = true;

    // Which photo sits in a given cell. Neighbours always differ, and the
    // pattern repeats far enough apart that the wall never feels like a grid of copies.
    const photoAt = (col, row) => mod(col + row * 7, N);

    function measure() {
        const w = window.innerWidth;
        cellW = w < 600 ? 150 : Math.min(280, Math.max(200, w * 0.16));
        cellH = cellW * 1.2;
        boxW = cellW * 0.7;
        boxH = cellH * 0.7;
        cols = Math.ceil(w / cellW) + 2;
        rows = Math.ceil(window.innerHeight / cellH) + 2;
    }

    function fit(photo, maxW, maxH) {
        const ratio = photo.width / photo.height;
        return ratio > maxW / maxH
            ? { width: maxW, height: maxW / ratio }
            : { width: maxH * ratio, height: maxH };
    }

    function buildTiles() {
        plane.textContent = '';
        tiles = [];
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tile = document.createElement('button');
                tile.type = 'button';
                tile.className = 'tile';
                tile.style.width = cellW + 'px';
                tile.style.height = cellH + 'px';
                const img = document.createElement('img');
                img.decoding = 'async';
                img.draggable = false;
                const label = document.createElement('span');
                label.className = 'tile-label';
                tile.append(img, label);
                tile.addEventListener('click', (event) => {
                    // Mouse and touch open photos on pointerup (so drags don't);
                    // this handles the keyboard (Enter / Space).
                    if (event.detail === 0) open(tile);
                });
                plane.append(tile);
                tiles.push({ el: tile, img, label, index: -1 });
            }
        }
        dirty = true;
    }

    function render() {
        const firstCol = Math.floor(-offX / cellW) - 1;
        const firstRow = Math.floor(-offY / cellH) - 1;
        let i = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tile = tiles[i++];
                const col = firstCol + c, row = firstRow + r;
                tile.el.style.transform = `translate3d(${col * cellW + offX}px, ${row * cellH + offY}px, 0)`;
                const index = photoAt(col, row);
                if (tile.index !== index) {
                    const photo = photos[index];
                    const size = fit(photo, boxW, boxH);
                    tile.index = index;
                    tile.img.src = photo.src;
                    tile.img.alt = photo.title;
                    tile.img.style.width = size.width + 'px';
                    tile.img.style.height = size.height + 'px';
                    tile.label.textContent = photo.title;
                    tile.el.setAttribute('aria-label', photo.title);
                    tile.el.dataset.index = index;
                }
            }
        }
    }

    function frame() {
        if (!dragging && (Math.abs(velX) > 0.05 || Math.abs(velY) > 0.05)) {
            offX += velX;
            offY += velY;
            velX *= 0.93;
            velY *= 0.93;
            dirty = true;
        }
        if (dirty) {
            render();
            dirty = false;
        }
        requestAnimationFrame(frame);
    }

    // Dragging, with a little momentum when you let go
    let dragging = false, pointerId = null, lastX = 0, lastY = 0, travelled = 0, lastMove = 0;

    wall.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || viewerOpen) return;
        dragging = true;
        pointerId = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        travelled = 0;
        velX = velY = 0;
        wall.setPointerCapture(pointerId);
    });

    wall.addEventListener('pointermove', (event) => {
        if (!dragging || event.pointerId !== pointerId) return;
        const dx = event.clientX - lastX, dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        offX += dx;
        offY += dy;
        velX = velX * 0.5 + dx * 0.5;
        velY = velY * 0.5 + dy * 0.5;
        lastMove = performance.now();
        travelled += Math.abs(dx) + Math.abs(dy);
        if (travelled > 6) {
            wall.classList.add('is-dragging');
            hint.classList.add('is-gone');
        }
        dirty = true;
    });

    function endDrag(event) {
        if (!dragging || event.pointerId !== pointerId) return;
        dragging = false;
        wall.classList.remove('is-dragging');
        if (performance.now() - lastMove > 80) velX = velY = 0; // paused before letting go
        if (travelled <= 6 && event.type === 'pointerup') {
            const under = document.elementFromPoint(event.clientX, event.clientY);
            const tile = under && under.closest('.tile');
            if (tile) open(tile);
        }
    }

    wall.addEventListener('pointerup', endDrag);
    wall.addEventListener('pointercancel', endDrag);

    wall.addEventListener('wheel', (event) => {
        if (viewerOpen) return;
        event.preventDefault();
        offX -= event.deltaX;
        offY -= event.deltaY;
        hint.classList.add('is-gone');
        dirty = true;
    }, { passive: false });

    // Arrow keys move the wall when it has focus
    document.addEventListener('keydown', (event) => {
        if (viewerOpen) return;
        const step = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
        if (!step || !wall.contains(document.activeElement)) return;
        velX = step[0] * 14;
        velY = step[1] * 14;
    });

    // ---------------------------------------------------------------- viewer

    let viewerOpen = false;
    let busy = false;
    let current = 0;
    let sourceTile = null;
    let zoomed = false;
    let closedByKeyboard = false;

    // Thumbnails of every photo, for jumping between them
    photos.forEach((photo, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', photo.title);
        const img = document.createElement('img');
        img.src = photo.src;
        img.alt = '';
        img.loading = 'lazy';
        button.append(img);
        button.addEventListener('click', () => show(index));
        strip.append(button);
    });

    function fillDetails(photo, index) {
        metaEl.textContent = photo.date || '';
        titleEl.textContent = photo.title;
        specsEl.textContent = '';
        [['Location', photo.place], ['Camera', photo.camera], ['Settings', photo.settings], ['Focal length', photo.focal]]
            .filter(([, value]) => value)
            .forEach(([label, value]) => {
                const row = document.createElement('div');
                const dt = document.createElement('dt');
                const dd = document.createElement('dd');
                dt.textContent = label;
                dd.textContent = value;
                row.append(dt, dd);
                specsEl.append(row);
            });
        countEl.textContent = `${index + 1} / ${N}`;
        strip.querySelectorAll('button').forEach((b, i) => {
            if (i === index) {
                b.setAttribute('aria-current', 'true');
                b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: viewerOpen ? 'smooth' : 'auto' });
            } else {
                b.removeAttribute('aria-current');
            }
        });
    }

    // Where the large photo should sit, in page coordinates
    function targetRect(photo) {
        if (phone.matches) {
            const pad = 20;
            const size = fit(photo, window.innerWidth - pad * 2, window.innerHeight * 0.72);
            const stageHeight = size.height + 88;
            stage.style.setProperty('--stage-height', stageHeight + 'px');
            const top = stage.getBoundingClientRect().top;
            return { left: (window.innerWidth - size.width) / 2, top: top + 64, ...size };
        }
        const box = stage.getBoundingClientRect();
        const pad = Math.max(32, box.width * 0.05);
        const size = fit(photo, box.width - pad * 2, box.height - pad * 2);
        return { left: box.left + (box.width - size.width) / 2, top: box.top + (box.height - size.height) / 2, ...size };
    }

    function placeImage(rect) {
        const box = stage.getBoundingClientRect();
        viewImg.style.left = rect.left - box.left + 'px';
        viewImg.style.top = rect.top - box.top + 'px';
        viewImg.style.width = rect.width + 'px';
        viewImg.style.height = rect.height + 'px';
        return rect;
    }

    function flipFrom(from, to) {
        const scale = from.width / to.width;
        return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`;
    }

    function loadLarge(photo, index) {
        const src = photo.large;
        const large = new Image();
        large.src = src;
        large.decode().then(() => {
            if (current === index && viewerOpen) viewImg.src = src;
        }).catch(() => {});
    }

    function onceTransitionEnds(el, callback, fallback) {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            el.removeEventListener('transitionend', handler);
            callback();
        };
        const handler = (event) => {
            if (event.target === el && event.propertyName === 'transform') finish();
        };
        el.addEventListener('transitionend', handler);
        setTimeout(finish, fallback);
    }

    function open(tile) {
        if (viewerOpen || busy) return;
        busy = true;
        viewerOpen = true;
        sourceTile = tile;
        current = Number(tile.dataset.index);
        const photo = photos[current];
        const from = tile.querySelector('img').getBoundingClientRect();

        viewImg.src = photo.src;
        viewImg.alt = photo.title;
        viewer.hidden = false;
        viewer.scrollTop = 0;
        fillDetails(photo, current);
        document.body.classList.add('is-viewing');

        const to = placeImage(targetRect(photo));
        viewImg.classList.remove('is-flying');
        viewImg.style.transform = flipFrom(from, to);
        // Starts as it looked on the wall (colour if hovered, b&w otherwise)
        viewImg.style.filter = tile.matches(':hover') ? 'none' : 'grayscale(1)';
        tile.classList.add('is-lifted');
        viewImg.getBoundingClientRect(); // apply the starting position before animating

        viewImg.classList.add('is-flying');
        viewer.classList.add('is-open');
        viewImg.style.transform = 'none';
        viewImg.style.filter = 'none';
        onceTransitionEnds(viewImg, () => {
            viewImg.classList.remove('is-flying');
            busy = false;
        }, 1000);
        loadLarge(photo, current);
        closeButton.focus({ preventScroll: true });
    }

    // The wall tile to fly back to: the one the photo came from. If you moved to
    // another photo while it was open, the wall (hidden behind the viewer) quietly
    // shifts sideways so that same spot now holds the photo being closed.
    function returnTile() {
        if (!sourceTile) return null;
        const shown = Number(sourceTile.dataset.index);
        if (shown !== current) {
            const rect = sourceTile.getBoundingClientRect();
            offX -= mod(current - shown, N) * cellW;
            render();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const tile = tiles.find((t) => {
                const r = t.el.getBoundingClientRect();
                return cx > r.left && cx < r.right && cy > r.top && cy < r.bottom;
            });
            return tile && tile.index === current ? tile.el : null;
        }
        return sourceTile;
    }

    function close() {
        if (!viewerOpen || busy) return;
        busy = true;
        resetZoom(true);
        const tile = returnTile();
        const finish = () => {
            viewer.hidden = true;
            viewImg.classList.remove('is-flying');
            viewImg.style.transform = '';
            viewImg.style.opacity = '';
            viewImg.style.filter = '';
            tiles.forEach((t) => t.el.classList.remove('is-lifted'));
            viewerOpen = false;
            busy = false;
            // Return keyboard focus to the photo, without a visible ring for mouse users
            if (tile) tile.focus({ preventScroll: true, focusVisible: closedByKeyboard });
            closedByKeyboard = false;
        };

        viewer.classList.remove('is-open');
        document.body.classList.remove('is-viewing');
        if (!tile) {
            viewImg.style.opacity = '0';
            setTimeout(finish, 500);
            return;
        }
        tiles.forEach((t) => t.el.classList.toggle('is-lifted', t.el === tile));
        const from = tile.querySelector('img').getBoundingClientRect();
        const to = viewImg.getBoundingClientRect();
        // Fly from the current spot back into the wall
        viewImg.classList.add('is-flying');
        viewImg.style.transform = flipFrom(from, to);
        viewImg.style.filter = 'grayscale(1)'; // lands back in b&w, like the wall
        onceTransitionEnds(viewImg, finish, 1000);
    }

    // Move to another photo inside the viewer
    function show(index) {
        index = mod(index, N);
        if (!viewerOpen || busy || index === current) return;
        resetZoom(true);
        current = index;
        const photo = photos[index];
        viewImg.classList.add('is-swapping');
        heading.classList.add('is-fading');
        foot.classList.add('is-fading');
        setTimeout(() => {
            fillDetails(photo, index);
            viewImg.src = photo.src;
            viewImg.alt = photo.title;
            placeImage(targetRect(photo));
            loadLarge(photo, index);
            requestAnimationFrame(() => {
                viewImg.classList.remove('is-swapping');
                heading.classList.remove('is-fading');
                foot.classList.remove('is-fading');
            });
        }, 200);
    }

    // Zoom: click the photo to look closer; the view follows the mouse
    const ZOOM = 2.6;

    function zoomOrigin(event) {
        const r = viewImg.getBoundingClientRect();
        const scale = zoomed ? ZOOM : 1;
        const x = (event.clientX - r.left) / (r.width / scale) * 100;
        const y = (event.clientY - r.top) / (r.height / scale) * 100;
        return `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`;
    }

    function resetZoom(instant) {
        if (!zoomed) return;
        zoomed = false;
        viewer.classList.remove('is-zoomed-in');
        viewImg.classList.remove('is-zoomed');
        if (instant) {
            viewImg.style.transition = 'none';
            viewImg.style.transform = 'none';
            viewImg.style.transformOrigin = '';
            viewImg.getBoundingClientRect();
            viewImg.style.transition = '';
        } else {
            viewImg.classList.add('is-unzooming');
            viewImg.style.transform = 'none';
            onceTransitionEnds(viewImg, () => {
                viewImg.classList.remove('is-unzooming');
                viewImg.style.transformOrigin = '';
            }, 700);
        }
    }

    viewImg.addEventListener('click', (event) => {
        if (busy || phone.matches) return;
        if (zoomed) {
            resetZoom(false);
            return;
        }
        zoomed = true;
        viewer.classList.add('is-zoomed-in');
        viewImg.style.transformOrigin = zoomOrigin(event);
        viewImg.classList.add('is-zoomed');
        viewImg.style.transform = `scale(${ZOOM})`;
    });

    stage.addEventListener('mousemove', (event) => {
        if (zoomed) viewImg.style.transformOrigin = zoomOrigin(event);
    });

    closeButton.addEventListener('click', close);

    // Clicking the empty space around the photo closes it (desktop)
    stage.addEventListener('click', (event) => {
        if (event.target === stage && !phone.matches) close();
    });

    document.addEventListener('keydown', (event) => {
        if (!viewerOpen) return;
        if (event.key === 'Escape') {
            closedByKeyboard = true;
            close();
        }
        else if (event.key === 'ArrowRight') show(current + 1);
        else if (event.key === 'ArrowLeft') show(current - 1);
    });

    // Keep keyboard focus inside the open photo
    viewer.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const focusable = [...viewer.querySelectorAll('button:not([hidden]), [href]')]
            .filter((el) => el.offsetParent !== null);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    window.addEventListener('resize', () => {
        measure();
        buildTiles();
        wall.classList.add('is-in');
        if (viewerOpen && !busy) {
            resetZoom(true);
            placeImage(targetRect(photos[current]));
        }
    });

    // ----------------------------------------------------------------- start

    measure();
    // Start with a photo-filled view centred on the screen
    offX = (window.innerWidth % cellW) / 2;
    offY = (window.innerHeight % cellH) / 2;
    buildTiles();
    render();
    requestAnimationFrame(frame);

    // Arriving: keep showing only the moving sky until every photo on the wall is
    // fully decoded, then fade the whole wall in as one (a single cheap fade,
    // rather than dozens of photos animating while they load).
    const ready = Promise.all(tiles.map((tile) => tile.img.decode().catch(() => {})));
    const atLeast = new Promise((resolve) => setTimeout(resolve, 300));
    const atMost = new Promise((resolve) => setTimeout(resolve, 8000));
    Promise.race([Promise.all([ready, atLeast]), atMost]).then(() => {
        requestAnimationFrame(() => {
            wall.classList.add('is-in');
            document.body.classList.add('is-arrived');
        });
    });
})();

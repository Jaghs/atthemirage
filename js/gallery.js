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
    const metaEl = viewer.querySelector('.viewer-meta');
    const titleEl = viewer.querySelector('.viewer-title');
    const specsEl = viewer.querySelector('.viewer-specs');
    const countEl = viewer.querySelector('.viewer-count');
    const closeButton = viewer.querySelector('.viewer-close');
    // Phones and upright tablets show an open photo stacked above its details
    const phone = window.matchMedia('(orientation: portrait) and (max-width: 1100px)');
    const N = photos.length;
    const tabsNav = document.querySelector('.tabs');

    const mod = (a, n) => ((a % n) + n) % n;

    // ---------------------------------------------------------------- places

    // A place for each country that has photos, with the most photographed first
    // (ties in alphabetical order), so the list sorts itself as photos are added
    const LABELS = {};
    const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const countOf = (name) => photos.filter((p) => p.group === name).length;
    const groupNames = [...new Set(photos.map((p) => p.group).filter(Boolean))]
        .sort((a, b) => countOf(b) - countOf(a) || a.localeCompare(b));

    // "all" shows the endless wall; a place lays its photos out once, centred
    let group = 'all';
    let list = photos.map((_, i) => i); // the photos (by index) in the current tab
    const isSet = () => group !== 'all';

    // ------------------------------------------------------------------ wall

    // The wall is a real scrolling area, so dragging and flicking it run on the
    // browser's own scrolling (full refresh rate, e.g. 120Hz on a ProMotion
    // iPhone, with native momentum). It's enormous, so it never runs out, and only
    // a screenful of tiles exists, moved ahead of you while they're off screen.
    const SPACE = 120000;
    const ORIGIN = SPACE / 2;
    const OVERSCAN = 2; // spare rows/columns of tiles beyond each edge of the screen

    let cellW = 0, cellH = 0, boxW = 0, boxH = 0;
    let cols = 0, rows = 0;
    let tiles = [];
    let offX = 0, offY = 0; // how far the wall has moved from where it started
    let velX = 0, velY = 0; // mouse-drag momentum
    let dirty = true;

    // Which photo sits in a given cell. Neighbours always differ, and the
    // pattern repeats far enough apart that the wall never feels like a grid of copies.
    const photoAt = (col, row) => list[mod(col + row * 7, list.length)];

    function measure() {
        const w = window.innerWidth;
        // Small photos on phones, including on their side (short screens)
        const short = window.innerHeight < 560;
        cellW = w < 600 || short ? 150 : Math.min(280, Math.max(200, w * 0.16));
        boxW = cellW * 0.7;
        boxH = cellW * 1.2 * 0.7;
        // Rows sit far enough apart that, with the first row just below the places
        // button, the row above stays hidden behind the header
        const head = document.querySelector('.site-head').getBoundingClientRect().bottom;
        const needed = belowPlaces() - head + 4;
        cellH = boxH + Math.max(cellW * 1.2 * 0.3, needed);
        if (isSet()) {
            // Just this place's photos, in as few rows as fit the screen
            const fitCols = Math.max(1, Math.floor((w - 32) / cellW));
            rows = Math.ceil(list.length / fitCols);
            cols = Math.ceil(list.length / rows); // balanced rows, e.g. 4 + 3 rather than 6 + 1
        } else {
            cols = Math.ceil(w / cellW) + 1 + OVERSCAN * 2;
            rows = Math.ceil(window.innerHeight / cellH) + 1 + OVERSCAN * 2;
        }
    }

    function fit(photo, maxW, maxH) {
        const ratio = photo.width / photo.height;
        return ratio > maxW / maxH
            ? { width: maxW, height: maxW / ratio }
            : { width: maxH * ratio, height: maxH };
    }

    // The scrollable area, and the scroll position matching offX / offY
    function sizePlane() {
        if (isSet()) {
            const top = setTop();
            plane.style.width = '100%';
            plane.style.height = Math.max(window.innerHeight, top + rows * cellH + 80) + 'px';
        } else {
            plane.style.width = SPACE + 'px';
            plane.style.height = SPACE + 'px';
        }
    }

    function applyScroll() {
        if (isSet()) return;
        wall.scrollLeft = ORIGIN - offX;
        wall.scrollTop = ORIGIN - offY;
    }

    wall.addEventListener('scroll', () => {
        if (isSet()) return;
        offX = ORIGIN - wall.scrollLeft;
        offY = ORIGIN - wall.scrollTop;
        dirty = true;
    }, { passive: true });

    function buildTiles() {
        plane.textContent = '';
        tiles = [];
        sizePlane();
        const count = isSet() ? list.length : rows * cols;
        for (let i = 0; i < count; i++) {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'tile';
            tile.style.width = cellW + 'px';
            tile.style.height = cellH + 'px';
            // The photo: a black-and-white copy, with the colour version laid
            // over it (invisible until hovered)
            const frame = document.createElement('span');
            frame.className = 'tile-photo';
            const img = document.createElement('img');
            img.decoding = 'async';
            img.draggable = false;
            const colour = document.createElement('img');
            colour.className = 'tile-colour';
            colour.decoding = 'async';
            colour.draggable = false;
            colour.alt = '';
            frame.append(img, colour);
            const label = document.createElement('span');
            label.className = 'tile-label';
            tile.append(frame, label);
            tile.addEventListener('click', () => {
                if (suppressClick) {
                    suppressClick = false; // that was the end of a mouse drag
                    return;
                }
                open(tile);
            });
            plane.append(tile);
            tiles.push({ el: tile, img, colour, frame, label, index: -1 });
        }
        dirty = true;
    }

    function render() {
        if (isSet()) return renderSet();
        // Cells are laid out on the scrolling area itself; only the tiles near
        // the screen exist, and they're moved along while out of sight
        const firstCol = Math.floor(-offX / cellW) - OVERSCAN;
        const firstRow = Math.floor(-offY / cellH) - OVERSCAN;
        let i = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tile = tiles[i++];
                const col = firstCol + c, row = firstRow + r;
                if (tile.col !== col || tile.row !== row) {
                    tile.col = col;
                    tile.row = row;
                    tile.el.style.transform = `translate(${ORIGIN + col * cellW}px, ${ORIGIN + row * cellH}px)`;
                }
                fillTile(tile, photoAt(col, row));
            }
        }
    }

    // The space between the header and the places button; the first row of photos
    // sits the same distance below the button, so nothing is behind it on arrival
    function belowPlaces() {
        const head = document.querySelector('.site-head').getBoundingClientRect();
        const places = document.querySelector('.places').getBoundingClientRect();
        return places.bottom + (places.top - head.bottom);
    }

    // Where the endless wall starts, so the first row's photos (centred in their
    // cells) begin just below the places button
    function startY() {
        const tallest = Math.max(...list.map((i) => fit(photos[i], boxW, boxH).height));
        return belowPlaces() - (cellH - tallest) / 2;
    }

    function setTop() {
        const below = belowPlaces();
        return Math.max(below, (window.innerHeight - rows * cellH) / 2);
    }

    // A place's photos, centred on the screen (the last row centred too). Taller
    // than the screen? The page simply scrolls.
    function renderSet() {
        const top = setTop();
        tiles.forEach((tile, i) => {
            const row = Math.floor(i / cols);
            const inRow = row === rows - 1 ? list.length - row * cols : cols;
            const left = (window.innerWidth - inRow * cellW) / 2;
            const x = left + (i - row * cols) * cellW;
            tile.el.style.transform = `translate(${x}px, ${top + row * cellH}px)`;
            fillTile(tile, list[i]);
        });
    }

    function fillTile(tile, index) {
        if (tile.index === index) return;
        const photo = photos[index];
        const size = fit(photo, boxW, boxH);
        tile.index = index;
        tile.img.src = photo.wall || photo.src;
        tile.img.alt = photo.title;
        if (photo.wall) tile.colour.src = photo.src;
        else tile.colour.removeAttribute('src');
        tile.colour.hidden = !photo.wall;
        tile.frame.style.width = size.width + 'px';
        tile.frame.style.height = size.height + 'px';
        tile.label.textContent = photo.title;
        tile.el.setAttribute('aria-label', photo.title);
        tile.el.dataset.index = index;
    }

    function frame() {
        // Momentum after a mouse drag (touch and trackpads use native momentum)
        if (!dragging && (Math.abs(velX) > 0.05 || Math.abs(velY) > 0.05)) {
            offX += velX;
            offY += velY;
            velX *= 0.93;
            velY *= 0.93;
            applyScroll();
            dirty = true;
        }
        if (dirty) {
            render();
            dirty = false;
        }
        requestAnimationFrame(frame);
    }

    // Dragging with a mouse (touch screens and trackpads scroll natively)
    let dragging = false, pointerId = null, lastX = 0, lastY = 0, travelled = 0, lastMove = 0;
    let suppressClick = false;

    wall.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || viewerOpen || isSet()) return;
        dragging = true;
        pointerId = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        travelled = 0;
        velX = velY = 0;
        suppressClick = false;
    });

    wall.addEventListener('pointermove', (event) => {
        if (!dragging || event.pointerId !== pointerId) return;
        const dx = event.clientX - lastX, dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        offX += dx;
        offY += dy;
        applyScroll();
        velX = velX * 0.5 + dx * 0.5;
        velY = velY * 0.5 + dy * 0.5;
        lastMove = performance.now();
        travelled += Math.abs(dx) + Math.abs(dy);
        if (travelled > 6) {
            // Only now hold on to the mouse (holding it from the start would stop
            // a plain click from reaching the photo)
            if (!wall.hasPointerCapture(pointerId)) wall.setPointerCapture(pointerId);
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
        suppressClick = travelled > 6;
    }

    wall.addEventListener('pointerup', endDrag);
    wall.addEventListener('pointercancel', endDrag);

    // Any touch or wheel movement counts as having found out how to explore
    ['touchmove', 'wheel'].forEach((type) => wall.addEventListener(type, () => hint.classList.add('is-gone'), { passive: true }));

    // Arrow keys move the wall when it has focus
    document.addEventListener('keydown', (event) => {
        if (viewerOpen || isSet()) return;
        const step = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
        if (!step || !wall.contains(document.activeElement)) return;
        event.preventDefault();
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
        button.dataset.index = index;
        button.addEventListener('click', () => show(list.indexOf(index)));
        strip.append(button);
    });

    function fillDetails(photo, index) {
        shareLabel.textContent = 'Share';
        metaEl.textContent = photo.date || '';
        titleEl.textContent = photo.title;
        specsEl.textContent = '';
        const where = photo.place || LABELS[photo.group] || photo.group;
        [['Location', where], ['Camera', photo.camera], ['Settings', photo.settings], ['Focal length', photo.focal]]
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
        countEl.textContent = `${list.indexOf(index) + 1} / ${list.length}`;
        strip.querySelectorAll('button').forEach((b) => {
            const i = Number(b.dataset.index);
            b.hidden = !list.includes(i);
            if (i === index) {
                b.setAttribute('aria-current', 'true');
                // Centre this thumbnail in the reel by scrolling the reel sideways only
                // (scrollIntoView would also scroll the whole view down to the reel)
                const left = b.offsetLeft - (strip.clientWidth - b.offsetWidth) / 2;
                strip.scrollTo({ left, behavior: viewerOpen ? 'smooth' : 'auto' });
            } else {
                b.removeAttribute('aria-current');
            }
        });
    }

    // Where the large photo should sit, in page coordinates
    function targetRect(photo) {
        if (phone.matches) {
            // Sized so the whole photo and its title and details fit on one screen,
            // the same for every photo; the reel waits just below
            const pad = 20, above = 64, gap = 20;
            const details = heading.getBoundingClientRect().height;
            const room = window.innerHeight - above - gap - details - 28;
            const size = fit(photo, window.innerWidth - pad * 2, Math.max(room, window.innerHeight * 0.35));
            stage.style.setProperty('--stage-height', above + size.height + gap + 'px');
            const top = stage.getBoundingClientRect().top;
            return { left: (window.innerWidth - size.width) / 2, top: top + above, ...size };
        }
        const box = stage.getBoundingClientRect();
        const pad = Math.max(32, box.width * 0.05);
        // On short screens (a phone on its side) the photo uses the full height
        const padY = window.innerHeight < 560 ? 12 : pad;
        const size = fit(photo, box.width - pad * 2, box.height - padY * 2);
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
        const from = tile.querySelector('.tile-photo').getBoundingClientRect();

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
        // Visitor stats: which photos people open (nothing personal is recorded)
        if (window.goatcounter && window.goatcounter.count) {
            window.goatcounter.count({ path: 'photo/' + photo.id, title: photo.title, event: true });
        }
        // Opening a photo is a step in the browser's history, so the back button
        // (or swiping back on a phone) closes it instead of leaving the gallery
        history.pushState({ photo: true }, '', location.pathname + '#photo-' + photo.id);
    }

    // Close buttons, Escape and clicking outside all go through history, so the
    // extra step added on opening is used up and back works as expected afterwards
    // (The close button, Escape and clicking outside always play the fly-back
    // animation; the history step they use up is then ignored)
    let ignoreNextPop = false;
    function requestClose() {
        if (!viewerOpen || busy) return;
        if (history.state && history.state.photo) {
            ignoreNextPop = true;
            history.back();
        }
        close();
    }

    // Was this "back" an edge swipe? Those always start with a finger at the very
    // edge of the screen moments before. A swipe animates the page itself, so the
    // photo closes instantly; any back button gets the fly-back animation.
    let lastEdgeTouch = -Infinity;
    document.addEventListener('touchstart', (event) => {
        const x = event.touches[0].clientX;
        if (x < 30 || x > window.innerWidth - 30) lastEdgeTouch = performance.now();
    }, { passive: true, capture: true });

    window.addEventListener('popstate', function closeWhenReady() {
        if (ignoreNextPop) {
            ignoreNextPop = false;
            return;
        }
        if (!viewerOpen) return;
        if (performance.now() - lastEdgeTouch < 1500) return closeInstantly();
        if (busy) setTimeout(closeWhenReady, 100); // still flying open: close once it lands
        else close();
    });

    // Going back shouldn't make the browser move anything by itself
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    // A reload while a photo was open: drop the leftover history step
    if (history.state && history.state.photo) history.replaceState(null, '', location.href);

    // The wall tile to fly back to: the one the photo came from. If you moved to
    // another photo while it was open, the wall (hidden behind the viewer) quietly
    // shifts sideways so that same spot now holds the photo being closed.
    function returnTile() {
        if (isSet()) {
            const tile = tiles.find((t) => t.index === current);
            return tile ? tile.el : null;
        }
        if (!sourceTile) return null;
        const shown = Number(sourceTile.dataset.index);
        if (shown !== current) {
            const rect = sourceTile.getBoundingClientRect();
            offX -= mod(list.indexOf(current) - list.indexOf(shown), list.length) * cellW;
            applyScroll();
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

    // On touch screens, going back (Safari's edge swipe) already animates the wall
    // back into view from a snapshot, so the photo closes instantly to match it,
    // leaving the wall exactly as it was
    function closeInstantly() {
        if (!viewerOpen) return;
        resetZoom(true);
        document.body.classList.add('is-instant');
        viewer.classList.remove('is-open');
        document.body.classList.remove('is-viewing');
        viewer.hidden = true;
        viewImg.classList.remove('is-flying');
        viewImg.style.transform = '';
        viewImg.style.opacity = '';
        viewImg.style.filter = '';
        tiles.forEach((t) => t.el.classList.remove('is-lifted'));
        viewerOpen = false;
        busy = false;
        requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('is-instant')));
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
        const from = tile.querySelector('.tile-photo').getBoundingClientRect();
        const to = viewImg.getBoundingClientRect();
        // Fly from the current spot back into the wall
        viewImg.classList.add('is-flying');
        viewImg.style.transform = flipFrom(from, to);
        viewImg.style.filter = 'grayscale(1)'; // lands back in b&w, like the wall
        onceTransitionEnds(viewImg, finish, 1000);
    }

    // Move to another photo inside the viewer
    function show(position) {
        const index = list[mod(position, list.length)];
        if (!viewerOpen || busy || index === current) return;
        resetZoom(true);
        current = index;
        const photo = photos[index];
        // Keep the address pointing at the photo on screen
        if (history.state && history.state.photo) {
            history.replaceState(history.state, '', location.pathname + '#photo-' + photo.id);
        }
        viewImg.classList.add('is-swapping');
        heading.classList.add('is-fading');
        countEl.classList.add('is-fading');
        setTimeout(() => {
            fillDetails(photo, index);
            viewImg.src = photo.src;
            viewImg.alt = photo.title;
            placeImage(targetRect(photo));
            loadLarge(photo, index);
            requestAnimationFrame(() => {
                viewImg.classList.remove('is-swapping');
                heading.classList.remove('is-fading');
                countEl.classList.remove('is-fading');
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

    // Phones: swipe the large photo left or right for the next or previous one
    let swipeX = null, swipeY = 0;
    stage.addEventListener('touchstart', (event) => {
        if (event.touches.length !== 1) return;
        // Swipes from the screen's edges belong to Safari (back / forward)
        const x = event.touches[0].clientX;
        if (x < 30 || x > window.innerWidth - 30) {
            swipeX = null;
            return;
        }
        swipeX = event.touches[0].clientX;
        swipeY = event.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', (event) => {
        if (swipeX === null) return;
        const dx = event.changedTouches[0].clientX - swipeX;
        const dy = event.changedTouches[0].clientY - swipeY;
        swipeX = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            show(list.indexOf(current) + (dx < 0 ? 1 : -1));
        }
    }, { passive: true });

    stage.addEventListener('mousemove', (event) => {
        if (zoomed) viewImg.style.transformOrigin = zoomOrigin(event);
    });

    closeButton.addEventListener('click', requestClose);

    // Clicking the empty space around the photo closes it (desktop)
    stage.addEventListener('click', (event) => {
        if (event.target === stage && !phone.matches) requestClose();
    });

    document.addEventListener('keydown', (event) => {
        if (!viewerOpen) return;
        if (event.key === 'Escape') {
            closedByKeyboard = true;
            requestClose();
        }
        else if (event.key === 'ArrowRight') show(list.indexOf(current) + 1);
        else if (event.key === 'ArrowLeft') show(list.indexOf(current) - 1);
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
        if (isSet()) wall.scrollTo(0, 0);
        else applyScroll();
        render();
        wall.classList.add('is-in');
        if (viewerOpen && !busy) {
            resetZoom(true);
            placeImage(targetRect(photos[current]));
        }
    });

    // ------------------------------------------------- pages (Gallery · About)

    const pill = tabsNav.querySelector('.tabs-pill');
    const aboutSection = document.querySelector('.about');
    let view = 'gallery';

    // Glide the pill under the chosen page
    function movePill(name) {
        tabsNav.querySelectorAll('button').forEach((b) => {
            const on = b.dataset.view === name;
            b.setAttribute('aria-pressed', String(on));
            if (on) {
                pill.style.transform = `translateX(${b.offsetLeft}px)`;
                pill.style.width = b.offsetWidth + 'px';
            }
        });
    }

    // Put the pill in place without gliding (first load, and once the font has
    // loaded or the window changes size, since the tabs' widths change)
    function placePill() {
        pill.classList.add('is-placing');
        movePill(view);
        pill.getBoundingClientRect();
        pill.classList.remove('is-placing');
    }

    window.addEventListener('resize', placePill);
    if (document.fonts) document.fonts.ready.then(placePill);

    function showView(name, instant) {
        if (name === view && !instant) return;
        view = name;
        movePill(name);
        const about = name === 'about';
        if (about) closeMenu();
        aboutSection.hidden = !about;
        document.body.classList.toggle('is-about', about);
    }

    tabsNav.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button || viewerOpen) return;
        showView(button.dataset.view);
        setHash();
    });

    // --------------------------------------------------------- places filter

    const placesButton = document.querySelector('.places-button');
    const placesLabel = placesButton.querySelector('.places-current');
    const menu = document.querySelector('.places-menu');
    const scrim = document.querySelector('.places-scrim');

    // A row for each place
    function menuRow(name, label, indexes) {
        const row = document.createElement('button');
        row.type = 'button';
        row.setAttribute('role', 'menuitemradio');
        row.dataset.group = name;
        const title = document.createElement('span');
        title.className = 'places-name';
        title.textContent = label;
        row.append(title);
        row.addEventListener('click', () => {
            closeMenu();
            choose(name);
        });
        menu.append(row);
    }

    menuRow('all', 'Everywhere', photos.map((_, i) => i));
    groupNames.forEach((name) => menuRow(name, name,
        photos.map((_, i) => i).filter((i) => photos[i].group === name)));

    function markPlace() {
        placesLabel.textContent = group === 'all' ? 'Everywhere' : group;
        menu.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.group === group)));
        hint.textContent = isSet() ? '' : 'drag to explore';
    }

    function openMenu() {
        menu.hidden = false;
        scrim.hidden = false;
        placesButton.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => document.body.classList.add('is-choosing'));
        const chosen = menu.querySelector('[aria-checked="true"]');
        if (chosen) chosen.focus({ preventScroll: true });
    }

    function closeMenu() {
        if (menu.hidden) return;
        document.body.classList.remove('is-choosing');
        placesButton.setAttribute('aria-expanded', 'false');
        setTimeout(() => {
            if (!document.body.classList.contains('is-choosing')) {
                menu.hidden = true;
                scrim.hidden = true;
            }
        }, 300);
    }

    placesButton.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
    scrim.addEventListener('click', closeMenu);
    document.addEventListener('click', (event) => {
        if (!menu.hidden && !event.target.closest('.places')) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !menu.hidden) {
            closeMenu();
            placesButton.focus();
        }
    });

    // Set the place without animating (on load), or with the fade (on choosing)
    function applyGroup(name) {
        group = groupNames.includes(name) ? name : 'all';
        list = photos.map((_, i) => i).filter((i) => group === 'all' || photos[i].group === group);
        velX = velY = 0;
        offX = isSet() ? 0 : (window.innerWidth % cellW) / 2;
        offY = isSet() ? 0 : startY();
        measure();
        buildTiles();
        if (isSet()) wall.scrollTo(0, 0);
        else applyScroll();
        render();
        markPlace();
    }

    let switching = false;
    function choose(name) {
        if (view !== 'gallery') showView('gallery');
        if (name === group || switching || viewerOpen) return;
        switching = true;
        group = name; // so the label and link update straight away
        markPlace();
        setHash();
        wall.classList.add('is-switching');
        setTimeout(() => {
            applyGroup(name);
            requestAnimationFrame(() => {
                wall.classList.remove('is-switching');
                switching = false;
            });
        }, 350);
    }

    // Links: main.html#about, main.html#japan, or plain main.html for everything
    function setHash() {
        const hash = view === 'about' ? '#about' : group === 'all' ? '' : '#' + slug(group);
        history.replaceState(history.state, '', location.pathname + hash);
    }

    function fromHash() {
        const wanted = decodeURIComponent(location.hash.slice(1));
        if (wanted === 'about') return { view: 'about', group: 'all' };
        if (wanted.startsWith('photo-')) return { view: 'gallery', group: 'all', photo: wanted.slice(6) };
        return { view: 'gallery', group: groupNames.find((name) => slug(name) === wanted) || 'all' };
    }

    window.addEventListener('hashchange', () => {
        const target = fromHash();
        if (target.photo) return; // set by opening a photo, not a place to go to
        showView(target.view);
        if (target.view === 'gallery') choose(target.group);
    });

    // Keep the places button and a place's photos clear of the header, whose
    // height differs between phones and computers
    function measureHeader() {
        const bottom = document.querySelector('.site-head').getBoundingClientRect().bottom;
        document.documentElement.style.setProperty('--head-bottom', bottom + 'px');
    }
    measureHeader();
    window.addEventListener('resize', measureHeader);

    // ------------------------------------------------- first visit on a phone

    // A one-time note explaining the wall; it goes as soon as they touch it
    function showTouchHint() {
        const note = document.querySelector('.touch-hint');
        if (!note || !window.matchMedia('(hover: none)').matches) return;
        try {
            if (localStorage.getItem('seen-touch-hint')) return;
            localStorage.setItem('seen-touch-hint', '1');
        } catch (e) { return; }
        note.hidden = false;
        setTimeout(() => note.classList.add('is-showing'), 900);
        const hide = () => {
            note.classList.remove('is-showing');
            setTimeout(() => (note.hidden = true), 600);
            wall.removeEventListener('touchstart', hide);
        };
        wall.addEventListener('touchstart', hide, { passive: true });
        setTimeout(hide, 6500);
    }

    // ----------------------------------------------------------------- start

    // The wall shows colour photos in black and white. Rather than storing a second
    // b&w file for each, make the grey version here, once, while the page loads.
    function greyscale(photo) {
        const img = new Image();
        img.src = photo.src;
        return img.decode().then(() => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = pixels.data;
            for (let i = 0; i < d.length; i += 4) {
                const y = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
                d[i] = d[i + 1] = d[i + 2] = y;
            }
            ctx.putImageData(pixels, 0, 0);
            return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        }).then((blob) => {
            if (blob) photo.wall = URL.createObjectURL(blob);
        }).catch(() => {});
    }

    const initial = fromHash();
    group = initial.group;
    list = photos.map((_, i) => i).filter((i) => group === 'all' || photos[i].group === group);
    measure();
    // Start with a photo-filled view centred on the screen
    offX = isSet() ? 0 : (window.innerWidth % cellW) / 2;
    offY = isSet() ? 0 : startY();
    buildTiles();
    if (isSet()) wall.scrollTo(0, 0);
    else applyScroll();
    markPlace();
    showView(initial.view, true);
    placePill();

    // Arriving: keep showing only the moving sky until every photo on the wall is
    // ready, then fade the whole wall in as one (a single cheap fade, rather than
    // dozens of photos animating while they load).
    const prepared = Promise.all(photos.filter((photo) => photo.colour).map(greyscale)).then(() => {
        render();
        return Promise.all(tiles.flatMap((tile) => [tile.img, tile.colour])
            .filter((img) => img.getAttribute('src'))
            .map((img) => img.decode().catch(() => {})));
    });
    const atLeast = new Promise((resolve) => setTimeout(resolve, 300));
    const atMost = new Promise((resolve) => setTimeout(resolve, 8000));
    Promise.race([Promise.all([prepared, atLeast]), atMost]).then(() => {
        dirty = true;
        requestAnimationFrame(frame);
        requestAnimationFrame(() => {
            wall.classList.add('is-in');
            document.body.classList.add('is-arrived');
            // After the slow arrival fade, switch to the quick timing used when
            // photos open and close
            setTimeout(() => document.body.classList.add('is-settled'), 1500);
            if (!openFromLink()) showTouchHint();
        });
    });

    // A shared photo link (main.html#photo-family-mart): open that photo once the
    // wall has arrived, from the nearest tile showing it
    function openFromLink() {
        const wanted = initial.photo;
        const index = photos.findIndex((p) => p.id === wanted);
        if (index < 0) return false;
        history.replaceState(null, '', location.pathname); // so back returns to the wall
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        let best = null, bestDist = Infinity;
        tiles.forEach((tile) => {
            if (tile.index !== index) return;
            const r = tile.frame.getBoundingClientRect();
            const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
            if (d < bestDist) {
                bestDist = d;
                best = tile.el;
            }
        });
        if (!best) return false;
        setTimeout(() => open(best), 500);
        return true;
    }

    // ------------------------------------------------------------------ share

    // Phones get the native share sheet; computers copy the link
    const shareButton = viewer.querySelector('.viewer-share');
    const shareLabel = shareButton.querySelector('span');
    shareButton.addEventListener('click', async () => {
        const photo = photos[current];
        const url = location.origin + '/p/' + photo.id + '.html';
        if (navigator.share && window.matchMedia('(hover: none)').matches) {
            try {
                await navigator.share({ title: photo.title + ' — at the mirage', url });
            } catch (e) {}
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            shareLabel.textContent = 'Link copied';
        } catch (e) {
            shareLabel.textContent = url;
        }
        clearTimeout(shareButton.reset);
        shareButton.reset = setTimeout(() => (shareLabel.textContent = 'Share'), 2000);
    });
})();

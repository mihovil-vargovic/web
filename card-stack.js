/* ══ Card stack ════════════════════════════════════════════
   From Bencho (bencho.dev), MIT — bencho.dev/licence.
   Ported from the React component to plain JS, because this
   site is a single HTML page with no framework and no build.
   The maths, the constants and the comments are Bencho's; what
   changed is only that state lives in a closure and the DOM is
   written directly instead of through React.

   NOT LOADED by index.html at the moment (the page uses
   card-swap.js). Its CSS (.stk-*) was removed from the page with
   the swap; it needs putting back to use this file again.

   A short pile of cards that fans out when you go near it and
   packs itself away when you leave.

   ── IT IS ONE ROTATION PER CARD, AND NOTHING ELSE ─────────
   The reflex is to animate x, y and rotation separately and
   tune three curves until the three agree. They never quite
   do, because they are describing one physical thing — a card
   pivoting in a hand — with three independent numbers, and
   any disagreement between them reads as the cards sliding
   rather than turning.

   So there is one number per card: the angle it is turned to.
   The pivot is a point PIVOT px BELOW the pile, well outside
   the block, and `transform-origin` puts it there — which means
   the sideways travel, the arc that drops the outer cards
   lower than the middle one, and the tilt are all the same
   rotation. The fan cannot come apart, because there is
   nothing to come apart.

   ── THE MARK LIVES IN THE LEFT EDGE ───────────────────────
   Which is not a decoration decision. A fanned card shows one
   sliver of itself — about 23px at the default spread — and
   that sliver is its left edge, because the card to its right
   covers the rest. Anything that identifies a card has to be
   inside that strip or it is only ever legible on the one
   card at the end of the fan. (Here every card is a photograph
   and the numeral is not drawn.)

   ── AND THE SCATTER IS SEEDED, NOT RANDOM ─────────────────
   A pile that squared itself up perfectly reads as a graphic
   of a pile, and a fan whose cards are at exactly 6.6 degrees
   apart reads as a chart. Both want a little disagreement in
   them — but from a table written down here rather than from
   Math.random, for two reasons. A wall can hold several
   copies of this block and they must not each be sitting at a
   different angle; and a number nobody chose cannot be tuned,
   which means the "organic" version could never be made
   better or worse on purpose. These five columns were picked
   by eye and they are the same five every time. */

(function () {
  "use strict";

  /* ── one spring, for everything that settles ───────────────
     Frames, not milliseconds. `dt` is expressed in sixtieths of
     a second and the damping is RAISED to it rather than
     multiplied by it, so a dropped frame decays the same amount
     of energy as the two frames it replaced. Multiplying is the
     version that makes a spring behave differently on a busy
     page, which is the hardest kind of bug to see.

     The loop parks itself the moment the value has settled. */

  /* 0..100 into the two numbers a spring actually has.

     The pair is chosen by DAMPING RATIO and then written back
     as stiffness and decay:

       zeta = -ln(d) / (2 * sqrt(k))

       0   → zeta ~0.85, heavy, arrives without a ring
       50  → zeta ~0.41
       100 → zeta ~0.20, lively, two visible rebounds

     Both ends shippable, which is the constraint that fixed the
     numbers rather than taste. */
  var springOf = function (tune) {
    return {
      /* stiffness: how hard it is pulled toward the target */
      k: 0.08 + (tune / 100) * 0.16,
      /* decay, per frame: how much of the velocity survives */
      d: 0.62 + (tune / 100) * 0.2,
    };
  };

  /* Read once. A preference, not a live input. */
  var stillness = function () {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var mix = function (a, b, t) { return a + (b - a) * t; };
  var rad = function (deg) { return (deg * Math.PI) / 180; };

  /* Units matter. The snap threshold is absolute, so a caller
     works in pixels or in 0..100 — a spring driven over 0..1
     would be "settled" before it had visibly moved.

     `go` restarts from where the value IS (cur and vel live
     outside it), so a target changed mid-flight continues
     rather than snapping. */
  function createSpring(onFrame) {
    var cur = 0;
    var vel = 0;
    var raf = 0;

    function go(target, tune, instant) {
      cancelAnimationFrame(raf);
      raf = 0;
      if (instant) {
        cur = target;
        vel = 0;
        onFrame(cur);
        return;
      }
      var s = springOf(tune);
      var prev = 0;
      var tick = function (t) {
        var dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
        prev = t;
        vel += (target - cur) * s.k * dt;
        vel *= Math.pow(s.d, dt);
        cur += vel * dt;
        if (Math.abs(target - cur) < 0.02 && Math.abs(vel) < 0.02) {
          cur = target;
          vel = 0;
          raf = 0;
          onFrame(cur);
          return;
        }
        onFrame(cur);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return { go: go };
  }

  /* ── the card, and everything is measured off it ───────────
     A 3:4 rectangle, which is the proportion of nearly every
     card anybody has held. Change these two and the stage, the
     pivot's reach and the block's own box all follow.
     (Bencho's own are 156×208; these are exactly double, with
     PIVOT, LIFT, DEEP and SHUT_OFF doubled to match.) */
  var CARD_W = 312;
  var CARD_H = 416;

  /* ── how far below the pile the hand is ────────────────────
     The whole geometry of the fan is this one distance. Short,
     and the cards swing wide for very little rotation — they
     read as sliding sideways. Long, and they rotate on the spot
     without ever separating.

     A little over a card and a quarter, which is where the two
     effects are about equal. It scales with the card, so the
     fan keeps its shape. */
  var PIVOT = 520;

  /* the widest the fan ever opens, corner to corner in degrees.
     Spread is a window on this, never the whole of it — see
     `arc` below. */
  var ARC = 40;

  /* ── the loosest the pile ever sits ────────────────────────
     Scatter at 100. A card can be five degrees off square and
     a little off centre, which is a deck somebody put down
     in a hurry rather than a deck somebody dropped. Past that it
     stops being a stack and becomes a mess, and the block is
     about a stack. */
  var SHUT_ROT = 5;
  var SHUT_OFF = 14;

  /* ── and the same disagreement in the OPEN fan ─────────────
     A SHARE OF THE STEP, not a number of degrees, and that
     correction is worth the line. It was a flat 2.2deg, which is
     a quarter of the step at the widest spread and nearly half
     of it at the tightest — so at Spread 0 with Scatter at 100
     two adjacent cards could land within half a degree of each
     other and one of them simply disappeared behind the other.

     As a share, the disorder is the same disorder at every
     spread and the cards cannot cross: the worst case is two
     neighbours leaning at each other by this much each, which
     still leaves more than half a step between them. */
  var RAGGED = 0.22;

  /* how much of the fan the SHUT pile already shows. A share of
     the open angle, so the resting pile is the same fan held
     partly closed — every card's edge peeks out on its own side
     — and opening is that fan carrying on rather than a squared
     pile changing into one. It sits inside
     the open fan's own reach, so the stage does not grow for it. */
  var REST = 0.4;

  /* how far each card behind the front one peeks out of the
     top of the pile, and how much smaller it is drawn. The
     recession is what makes cards in nearly the same place
     read as cards rather than as one thick one. */
  var DEEP = 10;
  var SINK = 0.016;

  /* how far the card under the pointer slides out of the fan,
     along its own axis — so it leaves the fan radially, the way
     a card is drawn from a hand, rather than simply moving up.

     It is load-bearing rather than decorative: the card
     stays where it is in the stacking order, so this distance is
     the whole of what makes it legible. */
  var LIFT = 40;

  /* the beat between one card and the next, so the cards read as
     one motion travelling along the fan. */
  var BEAT = 55;

  /* the most cards the fan is ever asked to hold. */
  var MAX = 6;

  /* ── the disagreement, written down ────────────────────────
     Five columns per card, all in -1..1, all multiplied by
     Scatter before they reach anything: how far off square it
     sits in the pile, how far off centre in each axis, how late
     it is out of the pile, and how much livelier or heavier its
     own spring is than the knob says.

     The last one is the one that does the most work. Six
     springs at identical stiffness arrive together however they
     are staggered, and a fan whose cards all stop on the same
     frame is the mechanical version of this no matter how
     uneven the angles are. */
  var SEED = [
    { rot: -0.62, dx: 0.41, dy: -0.28, beat: 0.34, tune: -0.22 },
    { rot: 0.83, dx: -0.55, dy: 0.36, beat: -0.47, tune: 0.31 },
    { rot: -0.24, dx: 0.68, dy: 0.52, beat: 0.71, tune: -0.44 },
    { rot: 0.47, dx: -0.31, dy: -0.63, beat: -0.18, tune: 0.58 },
    { rot: -0.91, dx: -0.72, dy: 0.19, beat: 0.52, tune: -0.36 },
    { rot: 0.36, dx: 0.24, dy: -0.47, beat: -0.66, tune: 0.27 },
  ];

  /* ── the room the block keeps, and it is ARITHMETIC ────────
     The stage clips on a wall that measures and scales a block
     — so a fan that opened past the block's own box would be cut
     off square. The box has to contain the widest thing this
     block can ever draw.

     `MOST` is that: half the widest arc, plus the raggedness
     that sits on top of it — and the raggedness is worst at
     THREE cards, where one step is the whole half-arc.
     Everything below falls out of it and out of the card's own
     size, so changing a constant above moves the box with it
     rather than leaving a number here that used to be right. */
  var MOST = (ARC / 2) * (1 + RAGGED);
  /* how far the end card's centre swings, and how far the arc
     carries it down */
  var SWING = PIVOT * Math.sin(rad(MOST));
  var DROP = PIVOT * (1 - Math.cos(rad(MOST)));
  /* a turned rectangle is wider and taller than a square one */
  var EXT_X = (CARD_W * Math.cos(rad(MOST)) + CARD_H * Math.sin(rad(MOST))) / 2;
  var EXT_Y = (CARD_W * Math.sin(rad(MOST)) + CARD_H * Math.cos(rad(MOST))) / 2;
  /* what the loosest pile adds on every side */
  var JIT =
    SHUT_OFF + (CARD_W * Math.sin(rad(SHUT_ROT)) + CARD_H * (1 - Math.cos(rad(SHUT_ROT)))) / 2;
  /* and how far the back of a full pile reaches above the front
     card's own top edge */
  var PILE = (MAX - 1) * DEEP;

  var STAGE_W = Math.ceil((SWING + EXT_X + JIT) * 2);
  /* The scatter margin is counted on both sides and the lift is
     counted once, above — and the two never happen at the same
     moment, because the pile only scatters when it is shut and
     a card is only drawn when the fan is open. The margin is
     shared on purpose rather than added twice. */
  var ABOVE = Math.max(CARD_H / 2 + PILE, EXT_Y - DROP) + LIFT + JIT;
  var BELOW = Math.max(CARD_H / 2, EXT_Y + DROP) + JIT;
  var STAGE_H = Math.ceil(ABOVE + BELOW);

  /* a mockup on each card, counted from the TOP of the pile, so the
     first is the front card at every count */
  var PHOTOS = [
    { src: "images/rln.png", alt: "Mobile stories feed with a create-new sheet" },
    { src: "images/kwi.png", alt: "Mobile flight search screen on kiwi.com" },
    { src: "images/kwi-1.png", alt: "Mobile activity screen with a ring chart of hours by category" },
    { src: "images/gmbld.png", alt: "Mobile app screen with a greeting, daily check-in and goal cards" },
    { src: "images/clvrlst.png", alt: "Mobile mood picker screen with a smiling bowl" },
    { src: "images/opl.png", alt: "Mobile car financing offer screen" },
  ];

  /* ── a card taken out to look at ───────────────────────────
     Click one and it leaves the deck, turns over once on its way
     and lands face up in the middle, as large as the block's own
     box allows; a click anywhere else (or Esc) sends it back to
     the place in the fan it came from — wherever that place is by
     then, since the fan may have folded meanwhile.

     It is ONE element flying, not the card restyled. The card
     stays where it is, hidden, so the fan's springs and the lift
     never meet the flight; the flyer starts on the card's own
     centre, angle and size and ends square in the middle. A face
     on each side, both the photograph, so the turn reads as a
     card being flipped over rather than a picture spinning.

     Sized to the stage, never past it. */
  var VIEW_H = STAGE_H - 24;
  var VIEW_W = Math.round((VIEW_H * CARD_W) / CARD_H);
  var VIEW_IN = 920;
  var VIEW_OUT = 660;
  /* the most the card in view leans under the pointer, at its edge */
  var TILT = 6;
  /* the pose at rest in the middle: turned over once, full size */
  var VIEW_AT = "perspective(2000px) translate(0px, 0px) rotate(0deg) rotateY(180deg) scale(1)";

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function image(photo) {
    var img = el("img", "stk-img");
    img.src = photo.src;
    img.alt = "";
    img.draggable = false;
    return img;
  }

  /* host: an empty block element. It is given a height and the
     stage is scaled down inside it when the viewport is narrower
     than the stage, so the fan never overflows a phone. */
  function CardStack(host, opts) {
    opts = opts || {};
    var spread = opts.spread == null ? 85 : opts.spread; /* how wide the fan opens, 0..100 */
    var bounce = opts.bounce == null ? 5 : opts.bounce; /* the spring, 0..100 */
    var scatter = opts.scatter == null ? 0 : opts.scatter; /* how much the pile and the fan disagree with themselves */
    var count = opts.count == null ? MAX : opts.count; /* how many cards, 3..6 */
    var corner = opts.corner == null ? 14 : opts.corner; /* the card's corner, px */

    var n = clamp(Math.round(count), 3, MAX);
    var sc = clamp(scatter, 0, 100) / 100;
    var still = stillness();

    /* `hover` is the pointer. `lit` is what each spring is aiming
       at, which is the same thing a moment later — and the
       moment is the cascade. */
    var hover = false;
    var lit = [];
    var at = [];
    /* which card the pointer is actually over, by slot. Null
       rather than -1 so "none" cannot be confused with a card. */
    var near = null;
    var timers = [];
    var lastOn = false;

    /* the card being looked at — by its id, not its slot, since it
       comes back to a different slot — and the pose it left from */
    var view = null;
    /* the order of the deck, top first, as card ids (a photo each).
       A card looked at goes back on TOP, so this changes; slot i
       shows deck[n - 1 - i] */
    var deck = [];
    var closing = false;
    var flyer = null;
    var tilt = null;
    var cards = [];
    var faces = [];
    /* each card's angle and recession as last drawn, so the flight
       can start from exactly where the card is */
    var poses = [];

    for (var k = 0; k < n; k += 1) {
      deck.push(k);
      lit.push(false);
      at.push(0);
    }

    /* the fan stays out while a card is in view, wherever the
       pointer goes; it folds once the card is home and nobody is
       over the deck */
    var isOn = function () { return hover || !!view; };

    /* ── the fan is a WIDTH, not a gap between cards ───────────
       Spread sets the whole arc and the cards divide it, so
       turning Cards up packs more into the same fan instead of
       growing the block.

       And the floor is 10 degrees rather than 0. A Spread knob
       whose bottom end is a stack that does not open is a knob
       with a broken setting on it. */
    var arc = 10 + (clamp(spread, 0, 100) / 100) * (ARC - 10);
    var step = arc / (n - 1);

    /* ── the open fan's own footprint, and a little air ────────
       The fan as it is drawn: the end cards' outer corners, the
       lifted card's top, the arc's drop below, plus PAD all
       round. Cards overlap, so there is no gap inside it to fall
       through. */
    var PAD = 14;
    var half = rad((arc / 2) * (1 + RAGGED * sc));
    var fanX = PIVOT * Math.sin(half) + (CARD_W * Math.cos(half) + CARD_H * Math.sin(half)) / 2;
    var fanTop = ABOVE - CARD_H / 2 - LIFT;
    var fanBottom =
      ABOVE + (CARD_W * Math.sin(half) + CARD_H * Math.cos(half)) / 2 + PIVOT * (1 - Math.cos(half));
    var fanPad = {
      left: STAGE_W / 2 - fanX - PAD,
      top: fanTop - PAD,
      width: (fanX + PAD) * 2,
      height: fanBottom - fanTop + PAD * 2,
    };

    /* ── the DOM ─────────────────────────────────────────────── */
    host.classList.add("stk-fit");
    var root = el("div", "stk");
    root.style.width = STAGE_W + "px";
    root.style.height = STAGE_H + "px";
    root.style.setProperty("--stk-w", STAGE_W + "px");
    root.style.setProperty("--stk-lift", LIFT + "px");
    var r = clamp(corner, 0, CARD_W / 2);
    root.style.setProperty("--stk-r", r + "px");
    root.style.setProperty("--stk-vr", ((r * VIEW_W) / CARD_W).toFixed(2) + "px");
    /* the lift rides a CSS transition rather than a spring of its
       own: a rule on the same element as a spring is two
       animations arguing over one property. It is a separate
       element and a separate property — `translate`, not
       `transform` — so the two cannot meet. */
    root.style.setProperty("--stk-ease", still ? "linear" : "cubic-bezier(0.4, 0, 0.2, 1)");

    /* ── what you have to be touching ─────────────────────
       Shut, it is the pile and a little air round it, so
       the block opens when you reach the cards rather than
       when you enter the tile. Open, it is the whole fan, so
       crossing it never falls through a gap between two cards
       and folds the thing away under your cursor.

       Behind the cards, so a card is always the thing you
       are over when you are over one. */
    var hit = el("span", "stk-hit");
    hit.setAttribute("aria-hidden", "true");
    /* ── and it is what says NO card is being drawn ─────
       A card raises itself on its own pointerenter, and
       nothing in that tells it when the pointer has moved
       off onto bare stage — leave/enter pairs between two
       cards race, and the one that loses leaves a card
       standing out of a fan nobody is pointing at. The pad
       is behind every card, so being over it is the
       definition of not being over one. */
    hit.addEventListener("pointerover", function () { setNear(null); });
    root.appendChild(hit);

    function sizeHit() {
      var o = isOn()
        ? fanPad
        : {
            left: (STAGE_W - CARD_W) / 2 - 10,
            top: ABOVE - CARD_H / 2 - PILE - 10,
            width: CARD_W + 20,
            height: CARD_H + PILE + 20,
          };
      hit.style.left = o.left + "px";
      hit.style.top = o.top + "px";
      hit.style.width = o.width + "px";
      hit.style.height = o.height + "px";
    }

    /* one element per card id; the slot it sits in is whatever the
       deck says, so a card keeps its element when it changes place */
    deck.forEach(function (id) {
      var card = el("span", "stk-card");
      card.style.left = (STAGE_W - CARD_W) / 2 + "px";
      card.style.top = ABOVE - CARD_H / 2 + "px";
      card.style.width = CARD_W + "px";
      card.style.height = CARD_H + "px";
      /* the hand, PIVOT below the card's middle. Every card turns
         about the same point, which is what makes this a fan
         rather than six cards that happen to be rotated. */
      card.style.transformOrigin = "50% " + (CARD_H / 2 + PIVOT) + "px";

      var face = el("span", "stk-face");
      var img = image(PHOTOS[id % PHOTOS.length]);
      img.alt = PHOTOS[id % PHOTOS.length].alt;
      face.appendChild(img);
      card.appendChild(face);
      root.appendChild(card);
      cards[id] = card;
      faces[id] = face;

      card.addEventListener("pointerenter", function () {
        var slot = n - 1 - deck.indexOf(id);
        if (near === slot) return;
        setNear(slot);
      });
      /* on the press, not the click: a first press often
         lands while the fan is still opening, the card turns
         out from under the pointer before the release, and
         a click needs both on the same element */
      card.addEventListener("pointerdown", function (e) {
        if (e.button === 0) open(n - 1 - deck.indexOf(id));
      });
    });

    host.appendChild(root);

    /* The stage may be wider than the text column — its corners are
       empty — so it only shrinks once the VIEWPORT is too narrow.
       Everything inside is measured through getBoundingClientRect and
       divided by this scale, so the flight keeps working. */
    function fit() {
      var w = Math.min(document.documentElement.clientWidth - 32, STAGE_W);
      var s = w > 0 ? Math.min(1, w / STAGE_W) : 1;
      root.style.transform = s < 1 ? "scale(" + s.toFixed(4) + ")" : "";
      host.style.height = Math.ceil(STAGE_H * s) + "px";
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
    else window.addEventListener("resize", fit);

    /* ── draw ────────────────────────────────────────────────────
       Each card's transform from its spring, its slot and the seed. */
    function render() {
      for (var i = 0; i < n; i += 1) {
        var u = at[i] / 100;
        /* 0 at the back of the pile, n-1 on top */
        var back = n - 1 - i;
        var c = i - (n - 1) / 2;
        var id = deck[back];

        /* where it sits shut, and where it sits open. One
           number each, and the card is somewhere between them
           on its own spring. */
        var openRot = c * step + SEED[i].rot * sc * RAGGED * step;
        var shutRot = c * step * REST + SEED[i].rot * sc * SHUT_ROT * 0.6;
        var shutX = SEED[i].dx * sc * SHUT_OFF;
        var shutY = -back * DEEP + SEED[i].dy * sc * SHUT_OFF;

        var lift = isOn() && near === i && !view;
        var rot = mix(shutRot, openRot, u);
        var recede = 1 - back * SINK * (1 - u);
        poses[i] = { rot: rot, scale: recede };

        var card = cards[id];
        /* rotate about that point, then nudge — so the
           scatter is a real offset in the block's own
           axes and not a second, tinier rotation */
        card.style.transform =
          "translate(" + mix(shutX, 0, u).toFixed(2) + "px, " + mix(shutY, 0, u).toFixed(2) + "px) " +
          "rotate(" + rot.toFixed(3) + "deg)";
        /* out of the deck while it is in view; it is still
           measured, so the flight home finds its place */
        card.style.visibility = view && view.id === id ? "hidden" : "";
        /* ── AND THE LIFTED CARD DOES NOT COME FORWARD ─
           Raising the card under the pointer to the front of
           the stack looks correct on the card at the right-hand
           end and is a disaster on any other: in a fan every
           card overlaps the one to its right, so bringing the
           leftmost one forward drew it over the three beside it
           and the fan became two cards and a hidden pile.

           The lift is enough on its own, and it is also the
           truthful version. The card slides out along its own
           axis, so it clears the top edges of its neighbours by
           exactly the distance it travelled — a card being drawn
           up out of a hand. */
        card.style.zIndex = i;

        var face = faces[id];
        /* the recession, and it is on the FACE rather
           than on the card: every transform in one
           declaration shares one origin, and this
           card's origin is far below it — a scale
           about that point would fling the card across
           the block instead of shrinking it.

           `scale` is its own property, so it can sit
           beside a transitioned `translate` without
           either touching the other. */
        face.style.scale = recede;
        if (lift) face.setAttribute("data-lift", "");
        else face.removeAttribute("data-lift");
      }
    }

    /* Six springs, one per slot, each a little livelier or heavier
       than the knob asks for — see SEED — which is what stops six
       cards arriving on the same frame. */
    var tune = function (i) { return clamp(bounce * (1 + SEED[i].tune * sc * 0.45), 0, 100); };
    var springs = [];
    for (var s = 0; s < n; s += 1) {
      (function (i) {
        springs[i] = createSpring(function (v) {
          at[i] = v;
          render();
        });
      })(s);
    }

    function setLit(i, v) {
      if (lit[i] === v) return;
      lit[i] = v;
      springs[i].go(v ? 100 : 0, tune(i), still);
    }

    function setNear(v) {
      if (near === v) return;
      near = v;
      render();
    }

    /* the cascade, which runs whenever the fan's wanted state flips */
    function sync() {
      var on = isOn();
      sizeHit();
      root.toggleAttribute("data-viewing", !!view);
      if (on === lastOn) return;
      lastOn = on;
      timers.forEach(clearTimeout);
      timers = [];
      var gap = still ? 0 : BEAT;
      for (var i = 0; i < n; i += 1) {
        /* ── out in front, home last ──────────────────────────
           Opening runs from the top of the pile down, so the
           card you can actually see is the one that leads; and
           closing runs the other way, so that same card is the
           last thing to land. Which is what a pile IS: the top
           card is on top because it arrived last. Reversing the
           order is the same mechanism read backwards, not a
           second one. */
        var place = on ? n - 1 - i : i;
        var delay = Math.max(0, gap * (place + SEED[i].beat * sc * 0.6));
        (function (i, delay) {
          if (delay <= 0) setLit(i, on);
          else timers.push(setTimeout(function () { setLit(i, on); }, delay));
        })(i, delay);
      }
    }

    function setHover(v) {
      if (hover === v) return;
      hover = v;
      sync();
    }

    /* ── `over`/`out`, not `enter`/`leave` ────────────────
       The wrapper is wider than the pile, so most of this box is
       air the fan has not reached yet. Air must not open anything
       — the block would spread from a cursor that was on its way
       somewhere else — so the wrapper takes no pointer events
       at all and the two things inside it that are real, the hit
       pad and the cards, take them back.

       Which means the handlers have to be on an event that
       BUBBLES from those children, and enter/leave do not.
       The containment test is what turns `out` back into
       `leave`. */
    root.addEventListener("pointerover", function () { setHover(true); });
    root.addEventListener("pointerout", function (e) {
      var to = e.relatedTarget;
      if (to && root.contains(to)) return;
      setHover(false);
      setNear(null);
    });
    root.addEventListener("pointercancel", function () {
      setHover(false);
      setNear(null);
    });

    /* where card i is now, as a transform on the flyer: its centre
       read off the screen (a rotated box keeps its centre), divided
       by whatever scale the page draws the block at */
    function poseOf(i) {
      var rr = root.getBoundingClientRect();
      var f = faces[deck[n - 1 - i]].getBoundingClientRect();
      var p = poses[i] || { rot: 0, scale: 1 };
      if (!rr.width) return VIEW_AT;
      var kk = rr.width / STAGE_W;
      var dx = (f.left + f.width / 2 - (rr.left + rr.width / 2)) / kk;
      var dy = (f.top + f.height / 2 - (rr.top + rr.height / 2)) / kk;
      var sz = (CARD_W / VIEW_W) * p.scale;
      return (
        "perspective(2000px) translate(" + dx.toFixed(2) + "px, " + dy.toFixed(2) + "px) rotate(" +
        p.rot.toFixed(3) + "deg) rotateY(0deg) scale(" + sz.toFixed(4) + ")"
      );
    }

    function open(i) {
      if (view) return;
      closing = false;
      view = { id: deck[n - 1 - i], from: poseOf(i) };
      sync();
      render();
      mountFlyer();
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("keydown", onKey);
    }

    function mountFlyer() {
      var photo = PHOTOS[view.id % PHOTOS.length];
      flyer = el("span", "stk-view");
      flyer.setAttribute("role", "img");
      flyer.setAttribute("aria-label", photo.alt + ". Click outside or press Escape to put it back");
      flyer.style.left = (STAGE_W - VIEW_W) / 2 + "px";
      flyer.style.top = (STAGE_H - VIEW_H) / 2 + "px";
      flyer.style.width = VIEW_W + "px";
      flyer.style.height = VIEW_H + "px";
      flyer.style.transform = view.from;

      tilt = el("span", "stk-view-tilt");
      /* a face each side, both the photograph */
      var front = el("span", "stk-view-face");
      front.appendChild(image(photo));
      var back = el("span", "stk-view-face");
      back.setAttribute("data-back", "");
      back.appendChild(image(photo));
      tilt.appendChild(front);
      tilt.appendChild(back);
      flyer.appendChild(tilt);
      root.appendChild(flyer);

      /* ── a slight tilt under the pointer ──────────────────
         The point you are over sinks away and the far side
         comes up (TILT degrees at the very edge). It is on an
         inner layer: the flyer's own transform belongs to the
         flight. Inside a card turned over (rotateY 180) the X
         axis runs backwards, so rotateX takes +ny; rotateY is
         unaffected */
      flyer.addEventListener("pointermove", function (e) {
        if (!tilt || closing || still) return;
        var b = flyer.getBoundingClientRect();
        var nx = clamp(((e.clientX - b.left) / b.width) * 2 - 1, -1, 1);
        var ny = clamp(((e.clientY - b.top) / b.height) * 2 - 1, -1, 1);
        tilt.style.transform =
          "rotateX(" + (ny * TILT).toFixed(2) + "deg) rotateY(" + (nx * TILT).toFixed(2) + "deg)";
      });
      flyer.addEventListener("pointerleave", function () {
        if (tilt) tilt.style.transform = "";
      });

      /* the flight in, the moment the flyer exists */
      flyer.animate([{ transform: view.from }, { transform: VIEW_AT }], {
        duration: still ? 1 : VIEW_IN,
        easing: still ? "linear" : "cubic-bezier(0.25, 0.8, 0.25, 1)",
        fill: "both",
      });
    }

    /* home is the TOP of the deck: the front slot's pose is read
       before the deck reorders (that slot is at rest — the fan is
       held open and nothing is lifted), then the card goes on top
       and the ones it passed slide down a slot while it flies in */
    function close() {
      if (!view || closing) return;
      closing = true;
      /* level again on the way home */
      if (tilt) tilt.style.transform = "";
      var home = poseOf(n - 1);
      var id = view.id;
      var moved = deck[0] !== id;
      deck = [id].concat(deck.filter(function (d) { return d !== id; }));
      /* while the others shift down a slot, their transforms glide
         rather than jump (see .stk[data-shuffle]) */
      if (moved) root.setAttribute("data-shuffle", "");
      render();
      var done = function () {
        document.removeEventListener("pointerdown", onDown, true);
        document.removeEventListener("keydown", onKey);
        if (flyer) flyer.remove();
        flyer = null;
        tilt = null;
        view = null;
        root.removeAttribute("data-shuffle");
        root.removeAttribute("data-viewing");
        render();
        sync();
      };
      if (!flyer || still) {
        done();
        return;
      }
      var anim = flyer.animate([{ transform: VIEW_AT }, { transform: home }], {
        duration: VIEW_OUT,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        fill: "forwards",
      });
      anim.onfinish = done;
    }

    /* a press anywhere but the card in view puts it back. Trusted
       presses only: a card's rehearsal drives scripted pointers at
       the page, and a rehearsal elsewhere must not shut this one */
    function onDown(e) {
      if (!e.isTrusted) return;
      if (flyer && flyer.contains(e.target)) return;
      close();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }

    sizeHit();
    render();
  }

  window.CardStack = CardStack;
})();

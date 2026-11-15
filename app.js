const money = (n) => "₦" + Number(n).toLocaleString();
const CATS = ["All", "Mains", "Grills", "Snacks", "Drinks"];
const STATUS = { new: "Received", preparing: "Preparing", done: "Ready" };
let auth;

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth.currentUser) {
    headers.Authorization = "Bearer " + (await auth.currentUser.getIdToken());
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong");
    err.status = res.status;
    throw err;
  }
  return data;
}

function niceError(e) {
  const map = {
    "auth/invalid-email": "That email address looks wrong.",
    "auth/user-not-found": "No account with that email. Try signing up.",
    "auth/wrong-password": "Wrong password.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/email-already-in-use": "That email already has an account. Try logging in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and try again.",
    "auth/unauthorized-domain": "This website address is not authorised in Firebase yet.",
    "auth/invalid-phone-number": "Invalid phone number. Use a format like +2348012345678.",
    "auth/too-many-requests": "Too many attempts. Please wait a bit and try again.",
    "auth/invalid-verification-code": "That code is wrong.",
    "auth/code-expired": "That code expired. Request a new one.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase.",
    "auth/billing-not-enabled": "Phone sign-in needs billing enabled in Firebase.",
    "auth/network-request-failed": "Network problem. Check your connection.",
  };
  return map[e.code] || e.message || "Something went wrong. Try again.";
}

function normalizePhone(p) {
  let s = p.replace(/[\s()-]/g, "");
  if (s.startsWith("0")) s = "+234" + s.slice(1);
  return s;
}

function useUser() {
  const [state, setState] = React.useState({ user: undefined });
  React.useEffect(() => auth.onIdTokenChanged((u) => setState({ user: u })), []);
  return state.user;
}

function displayName(user) {
  return user.displayName || user.email || user.phoneNumber || "Account";
}

/* ---------- Navbar ---------- */
function Navbar({ user, onLogin }) {
  return (
    <header className="nav">
      <a href="#" className="brand">🍛 Mama's Kitchen</a>
      <nav>
        <a href="#">Menu</a>
        {user && <a href="#orders">My orders</a>}
        {user ? (
          <button className="nav-btn" onClick={() => auth.signOut()}>Sign out</button>
        ) : (
          <button className="nav-btn primary" onClick={onLogin}>Sign in</button>
        )}
      </nav>
    </header>
  );
}

/* ---------- Sign in / Sign up modal ---------- */
function AuthModal({ onClose }) {
  const [mode, setMode] = React.useState("login");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [confirm, setConfirm] = React.useState(null);
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => () => {
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (e) {}
      window.recaptchaVerifier = null;
    }
  }, []);

  async function run(fn) {
    setError(""); setInfo(""); setBusy(true);
    try { await fn(); } catch (e) { setError(niceError(e)); }
    setBusy(false);
  }

  const google = () => run(async () => {
    await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    onClose();
  });

  const emailSubmit = (ev) => {
    ev.preventDefault();
    run(async () => {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Please enter your name.");
        const c = await auth.createUserWithEmailAndPassword(email.trim(), password);
        await c.user.updateProfile({ displayName: name.trim() });
        await c.user.getIdToken(true);
      } else {
        await auth.signInWithEmailAndPassword(email.trim(), password);
      }
      onClose();
    });
  };

  const forgot = () => run(async () => {
    if (!email.trim()) throw new Error("Type your email first, then tap Forgot password.");
    await auth.sendPasswordResetEmail(email.trim());
    setInfo("Reset link sent. Check your inbox (and spam folder).");
  });

  const sendCode = (ev) => {
    ev.preventDefault();
    run(async () => {
      const num = normalizePhone(phone);
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-box", { size: "invisible" });
      }
      try {
        setConfirm(await auth.signInWithPhoneNumber(num, window.recaptchaVerifier));
        setInfo("We sent a 6-digit code by SMS.");
      } catch (e) {
        try { window.recaptchaVerifier.clear(); } catch (x) {}
        window.recaptchaVerifier = null;
        throw e;
      }
    });
  };

  const verify = (ev) => {
    ev.preventDefault();
    run(async () => {
      await confirm.confirm(code.trim());
      onClose();
    });
  };

  const switchMode = (m) => { setMode(m); setError(""); setInfo(""); setConfirm(null); };

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Welcome 👋</h2>
        <p className="sub">Sign in to order and track your meals.</p>

        <button className="google-btn" onClick={google} disabled={busy}>
          <b>G</b> Continue with Google
        </button>
        <div className="divider">or</div>

        <div className="mode-tabs">
          <button className={mode === "login" ? "on" : ""} onClick={() => switchMode("login")}>Log in</button>
          <button className={mode === "signup" ? "on" : ""} onClick={() => switchMode("signup")}>Sign up</button>
          <button className={mode === "phone" ? "on" : ""} onClick={() => switchMode("phone")}>Phone</button>
        </div>

        {mode !== "phone" && (
          <form onSubmit={emailSubmit}>
            {mode === "signup" && (
              <input className="field" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="field" type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="main-btn" type="submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
            </button>
            {mode === "login" && (
              <button type="button" className="link-btn" onClick={forgot}>Forgot password?</button>
            )}
          </form>
        )}

        {mode === "phone" && !confirm && (
          <form onSubmit={sendCode}>
            <input className="field" type="tel" placeholder="Phone e.g. 08012345678 or +2348012345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="main-btn" type="submit" disabled={busy}>{busy ? "Sending..." : "Send code"}</button>
          </form>
        )}

        {mode === "phone" && confirm && (
          <form onSubmit={verify}>
            <input className="field" inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="main-btn" type="submit" disabled={busy}>{busy ? "Checking..." : "Verify & continue"}</button>
          </form>
        )}

        <div id="recaptcha-box"></div>
        {error && <div className="err">{error}</div>}
        {info && <div className="ok">{info}</div>}
        <button className="link-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/* ---------- Menu + checkout ---------- */
function Customer({ user, onLogin }) {
  const [menu, setMenu] = React.useState([]);
  const [cat, setCat] = React.useState("All");
  const [cart, setCart] = React.useState({});
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    api("/api/menu").then(setMenu).catch(() => setError("Could not load the menu."));
  }, []);

  const uname = user && user.displayName;
  React.useEffect(() => { if (uname) setName(uname); }, [uname]);

  const shown = menu.filter((m) => cat === "All" || m.cat === cat);
  const lines = menu.filter((m) => cart[m.id]).map((m) => ({ ...m, qty: cart[m.id] }));
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  const change = (id, d) =>
    setCart((c) => {
      const q = (c[id] || 0) + d;
      const n = { ...c };
      if (q <= 0) delete n[id]; else n[id] = q;
      return n;
    });

  async function placeOrder() {
    setError("");
    if (!name.trim() || !note.trim()) { setError("Enter your name and table number or delivery address."); return; }
    setSending(true);
    try {
      await api("/api/order", {
        method: "POST",
        body: JSON.stringify({ customer: name, note, items: lines.map((l) => ({ id: l.id, qty: l.qty })) }),
      });
      setCart({}); setNote(""); setDone(true);
    } catch (e) {
      setError(e.message);
    }
    setSending(false);
  }

  return (
    <div>
      <div className="hero">
        <h1>Homemade taste,<br />delivered hot.</h1>
        <p>{user ? "Welcome back, " + displayName(user) + " 👋" : "Fresh Nigerian classics, made to order."}</p>
        <div className="pills">
          <span className="pill">🕗 Open daily 8am – 10pm</span>
          <span className="pill">🔥 Cooked fresh</span>
        </div>
      </div>

      <div className="wrap">
        <h2 className="section-title">Our menu</h2>
        <div className="tabs">
          {CATS.map((c) => (
            <button key={c} className={"tab" + (cat === c ? " active" : "")} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>

        {menu.length === 0 && !error && <p className="empty">Loading menu...</p>}
        {error && !open && <div className="err">{error}</div>}

        {shown.map((m) => (
          <div className="card" key={m.id}>
            <div className="emoji">{m.emoji}</div>
            <div className="info">
              <h3>{m.name}</h3>
              <p>{m.desc}</p>
              <span className="price">{money(m.price)}</span>
            </div>
            {cart[m.id] ? (
              <div className="qty">
                <button onClick={() => change(m.id, -1)}>−</button>
                <b>{cart[m.id]}</b>
                <button onClick={() => change(m.id, 1)}>+</button>
              </div>
            ) : (
              <button className="add" onClick={() => change(m.id, 1)}>+</button>
            )}
          </div>
        ))}
      </div>

      {count > 0 && !open && (
        <button className="cartbar" onClick={() => { setDone(false); setError(""); setOpen(true); }}>
          <span>🛒 View cart ({count})</span>
          <span>{money(total)}</span>
        </button>
      )}

      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <div className="success">
                <div className="big">🎉</div>
                <h2>Order received!</h2>
                <p className="sub">The kitchen is on it. Track it under "My orders".</p>
                <button className="main-btn" onClick={() => { setOpen(false); setDone(false); }}>Back to menu</button>
              </div>
            ) : (
              <div>
                <h2>Your order</h2>
                <p className="sub">Review and confirm.</p>
                {lines.map((l) => (
                  <div className="line" key={l.id}>
                    <span>{l.qty} × {l.name}</span>
                    <span>{money(l.qty * l.price)}</span>
                  </div>
                ))}
                <div className="line total"><span>Total</span><span>{money(total)}</span></div>

                {user ? (
                  <div>
                    <input className="field" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                    <input className="field" placeholder="Table number or delivery address" value={note} onChange={(e) => setNote(e.target.value)} />
                    {error && <div className="err">{error}</div>}
                    <button className="main-btn" onClick={placeOrder} disabled={sending}>
                      {sending ? "Sending..." : "Place order · " + money(total)}
                    </button>
                  </div>
                ) : (
                  <button className="main-btn" onClick={onLogin}>Sign in to place order</button>
                )}
                <button className="link-btn" onClick={() => setOpen(false)}>Keep browsing</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Customer's own orders ---------- */
function MyOrders({ user, onLogin }) {
  const [orders, setOrders] = React.useState(null);
  const [error, setError] = React.useState("");

  const load = () => api("/api/myorders").then(setOrders).catch((e) => setError(e.message));

  React.useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [user]);

  return (
    <div>
      <div className="hero"><h1>My orders</h1><p>Updates automatically</p></div>
      <div className="wrap">
        {user === undefined && <p className="empty">Loading...</p>}
        {user === null && (
          <div className="empty">
            <p>Sign in to see your orders.</p>
            <button className="main-btn" onClick={onLogin}>Sign in</button>
          </div>
        )}
        {error && <div className="err">{error}</div>}
        {user && orders && orders.length === 0 && <p className="empty">No orders yet. Go pick something tasty 😋</p>}
        {user && orders && orders.map((o) => (
          <div key={o.id} className={"order " + o.status}>
            <h4><span>{new Date(o.createdAt).toLocaleString()}</span><span className="badge">{STATUS[o.status]}</span></h4>
            <ul>{o.items.map((i, k) => <li key={k}>{i.qty} × {i.name}</li>)}</ul>
            <b>{money(o.total)}</b>
            <small>{o.note}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Kitchen dashboard ---------- */
function Admin({ user, onLogin }) {
  const [orders, setOrders] = React.useState([]);
  const [error, setError] = React.useState("");

  const load = () =>
    api("/api/admin").then((d) => { setOrders(d); setError(""); }).catch((e) => setError(e.message));

  React.useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [user]);

  async function setStatus(id, status) {
    await api("/api/admin", { method: "POST", body: JSON.stringify({ id, status }) });
    load();
  }

  return (
    <div>
      <div className="hero"><h1>Kitchen orders 👨‍🍳</h1><p>Refreshes every 5 seconds</p></div>
      <div className="wrap">
        {user === undefined && <p className="empty">Loading...</p>}
        {user === null && (
          <div className="empty">
            <p>Staff sign-in required.</p>
            <button className="main-btn" onClick={onLogin}>Sign in</button>
          </div>
        )}
        {error && <div className="err">{error}</div>}
        {user && !error && orders.length === 0 && <p className="empty">No orders yet.</p>}
        {user && !error && orders.map((o) => (
          <div key={o.id} className={"order " + o.status}>
            <h4><span>{o.customer}</span><span className="badge">{STATUS[o.status]}</span></h4>
            <small>{o.note} · {o.contact}</small>
            <ul>{o.items.map((i, k) => <li key={k}>{i.qty} × {i.name}</li>)}</ul>
            <b>{money(o.total)}</b>
            <div className="actions">
              <button onClick={() => setStatus(o.id, "preparing")}>Preparing</button>
              <button onClick={() => setStatus(o.id, "done")}>Done</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <b>Mama's Kitchen</b><br />
      Open daily 8am – 10pm<br />
      © {new Date().getFullYear()} Mama's Kitchen. All rights reserved.
    </footer>
  );
}

/* ---------- App ---------- */
function App() {
  const user = useUser();
  const [hash, setHash] = React.useState(window.location.hash);
  const [showAuth, setShowAuth] = React.useState(false);

  React.useEffect(() => {
    const f = () => { setHash(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const login = () => setShowAuth(true);

  let page;
  if (hash === "#admin") page = <Admin user={user} onLogin={login} />;
  else if (hash === "#orders") page = <MyOrders user={user} onLogin={login} />;
  else page = <Customer user={user} onLogin={login} />;

  return (
    <div>
      <Navbar user={user} onLogin={login} />
      {page}
      <Footer />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}

/* ---------- Start ---------- */
fetch("/api/config")
  .then((r) => { if (!r.ok) throw new Error("config"); return r.json(); })
  .then((cfg) => {
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    ReactDOM.createRoot(document.getElementById("root")).render(<App />);
  })
  .catch(() => {
    document.getElementById("root").innerHTML =
      "<p style='padding:30px;font-family:sans-serif'>Site not configured yet. Check FIREBASE_WEB_CONFIG in Vercel.</p>";
  });

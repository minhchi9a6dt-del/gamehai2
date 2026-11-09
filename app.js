
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

// 1. CẤU HÌNH FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyC3Byfkz5DxS5YRv22TbvDkiObFy7TEhFU",
  authDomain: "game-tieng-viet-lop-2.firebaseapp.com",
  databaseURL: "https://game-tieng-viet-lop-2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "game-tieng-viet-lop-2",
  storageBucket: "game-tieng-viet-lop-2.firebasestorage.app",
  messagingSenderId: "828197214764",
  appId: "1:828197214764:web:f7b42f2974afc37ad84f89"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = id => document.getElementById(id);
const words = ["nhớ", "tươi vui", "thân thiết", "vui đùa"];
const correct = ["thân thiết", "nhớ", "vui đùa"];

let uid = "";
let role = "";
let code = "";
let team = 0;
let room = null;
let unsubscribe = null;
let selected = [null, null, null];
let activeBlank = 0;
let lastRound = 0;

const show = (id, yes = true) => {
  const el = $(id);
  if (el) el.classList.toggle("hidden", !yes);
};

const notice = msg => {
  show("notice", !!msg);
  $("notice").textContent = msg || "";
};

const fmt = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") +
    ":" + String(s % 60).padStart(2, "0");
};

const roomRef = () => ref(db, "rooms/" + code);

const studentLink = () =>
  location.origin + location.pathname +
  "?role=student&room=" + code;

function setRoute(nextRole, nextCode) {
  role = nextRole;
  code = nextCode;

  const p = new URLSearchParams();
  p.set("role", role);
  p.set("room", code);

  history.replaceState(null, "", location.pathname + "?" + p);

  show("home", false);
  show("teacher", role === "teacher");
  show("student", role === "student");
  notice("");
}

function errorText(e) {
  console.error(e);
  if (e.code === "PERMISSION_DENIED" ||
      e.code === "permission_denied") {
    return "Firebase từ chối quyền truy cập. Kiểm tra Rules.";
  }
  return e.message || "Có lỗi kết nối Firebase.";
}

// 2. ĐĂNG NHẬP ẨN DANH
async function login() {
  if (auth.currentUser) {
    uid = auth.currentUser.uid;
    return;
  }

  const result = await signInAnonymously(auth);
  uid = result.user.uid;
}

// 3. TẠO PHÒNG GIÁO VIÊN
$("create").onclick = async () => {
  const btn = $("create");
  btn.disabled = true;

  try {
    await login();

    let newCode;
    let created = false;

    for (let i = 0; i < 10 && !created; i++) {
      newCode = String(
        Math.floor(100000 + Math.random() * 900000)
      );

      const target = ref(db, "rooms/" + newCode);

      const result = await runTransaction(
        target,
        current => {
          if (current !== null) return;
          return {
            code: newCode,
            teacherUid: uid,
            status: "waiting",
            round: 1,
            createdAt: Date.now(),
            startedAt: 0,
            endedAt: 0,
            teams: {},
            results: {}
          };
        },
        { applyLocally: false }
      );

      created = result.committed;
    }

    if (!created) {
      throw Error("Không tạo được mã phòng. Hãy thử lại.");
    }

    localStorage.setItem("fish_teacher_" + newCode, uid);
    setRoute("teacher", newCode);
    listenRoom();

  } catch (e) {
    notice(errorText(e));
  } finally {
    btn.disabled = false;
  }
};

// 4. HỌC SINH VÀO PHÒNG
$("student-entry").onclick = () => show("join-entry", true);

$("go-room").onclick = async () => {
  const c = $("code-input").value.trim();

  if (!/^\d{6}$/.test(c)) {
    return notice("Vui lòng nhập mã phòng gồm 6 chữ số.");
  }

  try {
    await login();
    setRoute("student", c);
    team = 0;
    listenRoom();
  } catch (e) {
    notice(errorText(e));
  }
};

// 5. LẮNG NGHE DỮ LIỆU THỜI GIAN THỰC
function listenRoom() {
  if (unsubscribe) unsubscribe();

  unsubscribe = onValue(
    roomRef(),
    snapshot => {
      if (!snapshot.exists()) {
        notice("Không tìm thấy phòng chơi.");
        return;
      }

      room = snapshot.val();
      render();
    },
    e => notice("Lỗi đồng bộ: " + errorText(e))
  );
}

function render() {
  if (!room) return;

  if (role === "teacher") {
    renderTeacher();
  } else if (role === "student") {
    renderStudent();
  }
}

// 6. GIAO DIỆN GIÁO VIÊN
function renderTeacher() {
  $("teacher-code").textContent = code;

  const states = {
    waiting: "Đang chờ",
    playing: "Đang thi",
    finished: "Đã công bố"
  };

  $("teacher-state").textContent = states[room.status];

  const teams = room.teams || {};
  const results = room.results || {};
  const joined = Object.keys(teams);

  $("start").disabled =
    room.status !== "waiting" || joined.length === 0;

  $("finish").disabled = room.status !== "playing";

  $("teacher-teams").innerHTML =
    Array.from({ length: 5 }, (_, i) => {
      const n = i + 1;
      const member = teams[n];
      const result = results[n];

      return `
        <div class="team ${result ? "done" : member ? "joined" : ""}">
          <div class="icon">${["🐠","🐟","🐡","🐬","🐸"][i]}</div>
          <strong>Nhóm ${n}</strong>
          <small>${
            result ? "✅ Đã nộp" :
            member ? "🟢 Đã kết nối" :
            "⚪ Chưa vào"
          }</small>
          ${result ? `
            <p><b>${result.score}/3 câu</b><br>
            ${fmt(result.elapsedMs)}</p>
          ` : ""}
          ${member && room.status === "waiting" ? `
            <button class="secondary" data-remove="${n}">
              Xóa iPad
            </button>
          ` : ""}
        </div>
      `;
    }).join("");

  document.querySelectorAll("[data-remove]").forEach(btn => {
    btn.onclick = () => {
      if (confirm("Cho nhóm này chọn lại iPad?")) {
        removeTeam(Number(btn.dataset.remove));
      }
    };
  });

  const link = studentLink();
  $("student-url").href = link;
  $("student-url").textContent = link;

  $("qr").src =
    "https://api.qrserver.com/v1/create-qr-code/" +
    "?size=220x220&data=" + encodeURIComponent(link);

  show("ranking-panel", room.status === "finished");

  if (room.status === "finished") {
    const ranking = Object.entries(results)
      .map(([n, r]) => ({ team: Number(n), ...r }))
      .sort((a, b) =>
        b.score - a.score || a.elapsedMs - b.elapsedMs
      );

    $("ranking").innerHTML = ranking.map((r, i) => `
      <div class="rank">
        <strong>${["🥇","🥈","🥉","⭐","⭐"][i]}
          Nhóm ${r.team}</strong>
        <span>${r.score}/3 câu · ${fmt(r.elapsedMs)}</span>
      </div>
    `).join("") || "Chưa có nhóm nộp bài.";
  }

  updateClock();
}

// 7. HỌC SINH CHỌN NHÓM
function renderStudent() {
  $("student-code").textContent = code;
  $("my-team").textContent =
    team ? "Nhóm " + team : "Chưa chọn nhóm";

  $("student-state").textContent = ({
    waiting: "Đang chờ",
    playing: "Đang thi",
    finished: "Kết thúc"
  })[room.status];

  const teams = room.teams || {};
  const results = room.results || {};

  if (team && (!teams[team] || teams[team].uid !== uid)) {
    team = 0;
    selected = [null, null, null];
  }

  if (lastRound && lastRound !== room.round) {
    selected = [null, null, null];
    activeBlank = 0;
  }
  lastRound = room.round;

  if (!team) {
    show("team-picker", true);
    show("waiting", false);
    show("playing", false);
    show("submitted", false);
    show("student-finished", false);
    renderTeamPicker();
    return;
  }

  show("team-picker", false);

  const submitted = !!results[team];

  show("waiting", room.status === "waiting");
  show("playing", room.status === "playing" && !submitted);
  show("submitted", room.status === "playing" && submitted);
  show("student-finished", room.status === "finished");

  if (room.status === "playing" && !submitted) {
    renderExercise();
  }

  if (room.status === "finished") {
    const result = results[team];

    $("student-result").textContent = result
      ? `Nhóm ${team} đúng ${result.score}/3 câu, thời gian ${fmt(result.elapsedMs)}.`
      : "Nhóm chưa nộp bài. Chờ vòng mới nhé!";
  }

  updateClock();
}

function renderTeamPicker() {
  const teams = room.teams || {};

  $("team-buttons").innerHTML =
    Array.from({ length: 5 }, (_, i) => {
      const n = i + 1;
      const taken = !!teams[n];

      return `
        <button class="team-choice ${taken ? "taken" : "primary"}"
          data-team="${n}"
          ${taken || room.status !== "waiting" ? "disabled" : ""}>
          ${["🐠","🐟","🐡","🐬","🐸"][i]}
          Nhóm ${n}<br>
          <small>${taken ? "Đã có iPad" : "Chọn nhóm"}</small>
        </button>
      `;
    }).join("");

  document.querySelectorAll("[data-team]").forEach(btn => {
    btn.onclick = () => joinTeam(Number(btn.dataset.team));
  });
}

async function joinTeam(n) {
  try {
    const target = ref(db, `rooms/${code}/teams/${n}`);

    const result = await runTransaction(
      target,
      current => {
        if (current !== null) return;
        return {
          uid,
          joinedAt: Date.now()
        };
      },
      { applyLocally: false }
    );

    if (!result.committed) {
      return notice("Nhóm đã có iPad. Hãy chọn nhóm khác.");
    }

    team = n;
    localStorage.setItem("fish_team_" + code, String(n));
    notice("");
    render();

  } catch (e) {
    notice(errorText(e));
  }
}

// 8. GIÁO VIÊN ĐIỀU KHIỂN
async function teacherAction(action) {
  if (!room || room.teacherUid !== uid) {
    return notice("Thiết bị này không có quyền giáo viên.");
  }

  try {
    if (action === "start") {
      if (room.status !== "waiting") return;
      if (!Object.keys(room.teams || {}).length) {
        return notice("Chưa có nhóm nào tham gia.");
      }

      await update(roomRef(), {
        status: "playing",
        startedAt: Date.now(),
        endedAt: 0,
        results: {}
      });
    }

    if (action === "finish") {
      await update(roomRef(), {
        status: "finished",
        endedAt: Date.now()
      });
    }

    if (action === "reset") {
      await update(roomRef(), {
        status: "waiting",
        startedAt: 0,
        endedAt: 0,
        round: (room.round || 1) + 1,
        results: {}
      });
    }

    notice("");
  } catch (e) {
    notice(errorText(e));
  }
}

$("start").onclick = () => teacherAction("start");
$("finish").onclick = () => teacherAction("finish");

$("reset").onclick = () => {
  if (confirm("Bắt đầu vòng mới? Kết quả cũ sẽ được xóa.")) {
    teacherAction("reset");
  }
};

async function removeTeam(n) {
  try {
    await remove(ref(db, `rooms/${code}/teams/${n}`));
  } catch (e) {
    notice(errorText(e));
  }
}

// 9. HIỂN THỊ BÀI TẬP
function renderExercise() {
  document.querySelectorAll("[data-blank]").forEach(btn => {
    const i = Number(btn.dataset.blank);

    btn.textContent = selected[i] || "Chọn từ…";
    btn.classList.toggle("selected", i === activeBlank);

    btn.onclick = () => {
      activeBlank = i;
      renderExercise();
    };

    btn.ondblclick = () => {
      selected[i] = null;
      renderExercise();
    };
  });

  $("word-bank").innerHTML = words.map(w => `
    <button class="word ${selected.includes(w) ? "used" : ""}"
      data-word="${w}"
      ${selected.includes(w) ? "disabled" : ""}>
      ${w}
    </button>
  `).join("");

  document.querySelectorAll("[data-word]").forEach(btn => {
    btn.onclick = () => {
      const w = btn.dataset.word;
      selected[activeBlank] = w;

      const next = selected.findIndex(x => !x);
      if (next >= 0) activeBlank = next;

      renderExercise();
    };
  });

  $("submit").disabled = selected.some(x => !x);
}

// 10. NỘP BÀI
$("submit").onclick = async () => {
  if (selected.some(x => !x)) {
    return notice("Hãy điền đủ 3 ô trống.");
  }

  if (!confirm("Nhóm đã thống nhất đáp án và muốn nộp bài?")) {
    return;
  }

  try {
    const answers = [...selected];

    const score = answers.reduce(
      (total, value, i) =>
        total + (value === correct[i] ? 1 : 0),
      0
    );

    const submittedAt = Date.now();

    const result = await runTransaction(
      ref(db, `rooms/${code}/results/${team}`),
      current => {
        if (current !== null) return;

        return {
          uid,
          answers,
          score,
          submittedAt,
          elapsedMs: Math.max(
            0,
            submittedAt - room.startedAt
          )
        };
      },
      { applyLocally: false }
    );

    if (!result.committed) {
      notice("Nhóm đã nộp bài rồi.");
    } else {
      notice("");
    }

  } catch (e) {
    notice(errorText(e));
  }
};

// 11. ĐỒNG HỒ
function updateClock() {
  if (!room) return;

  const elapsed = room.startedAt
    ? (room.endedAt || Date.now()) - room.startedAt
    : 0;

  if (role === "teacher") {
    $("teacher-timer").textContent = "⏱ " + fmt(elapsed);
  }

  if (role === "student") {
    $("student-timer").textContent = "⏱ " + fmt(elapsed);
  }
}

// 12. SAO CHÉP LIÊN KẾT
$("copy-link").onclick = async () => {
  try {
    await navigator.clipboard.writeText(studentLink());
    notice("Đã sao chép liên kết học sinh.");
  } catch {
    notice("Hãy sao chép liên kết hiển thị dưới mã QR.");
  }
};

// 13. KHỞI ĐỘNG
async function init() {
  try {
    await login();

    const p = new URLSearchParams(location.search);
    const r = p.get("role");
    const c = p.get("room");

    if (
      (r === "teacher" || r === "student") &&
      /^\d{6}$/.test(c || "")
    ) {
      setRoute(r, c);

      if (r === "student") {
        team = Number(
          localStorage.getItem("fish_team_" + c) || 0
        );
      }

      listenRoom();
    }

  } catch (e) {
    notice("Không đăng nhập được Firebase: " + errorText(e));
  }
}

setInterval(updateClock, 250);
init();

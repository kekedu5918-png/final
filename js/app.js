
'use strict';
/* ═══════════════════════════════════════════════════════
   OPJ ELITE — Script principal
   Ordre HTML : config.js, sanitize.js, fsrs, audio, supabase, données, pv-cartouches-extra, puis ce fichier
   ═══════════════════════════════════════════════════════ */

const _CFG = window.OPJ_CONFIG || {};
const APP_CONFIG = _CFG;
(function migrateOpjeStorage() {
  const OLD_KEY = 'opje_v60';
  const NEW_KEY = _CFG.STORAGE_KEY || 'opje_v61';
  try {
    if (localStorage.getItem(NEW_KEY)) return;
    const legacy = localStorage.getItem(OLD_KEY);
    if (!legacy) return;
    const data = JSON.parse(legacy);
    if (data.user && data.user.grade !== undefined) delete data.user.grade;
    localStorage.setItem(NEW_KEY, JSON.stringify(data));
    localStorage.removeItem(OLD_KEY);
    console.info('[OPJ] Migration stockage ' + OLD_KEY + ' → ' + NEW_KEY + ' : OK');
  } catch (e) {
    try { localStorage.removeItem(OLD_KEY); } catch (_) {}
    console.warn('[OPJ] Migration stockage : données v60 illisibles, ignorées.');
  }
})();
const APP_VERSION = _CFG.APP_VERSION || 'v61.0';
const STORAGE_KEY = _CFG.STORAGE_KEY || 'opje_v61';
const STATE_VERSION = _CFG.STATE_VERSION || 61;
const SUPABASE_URL = _CFG.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = _CFG.SUPABASE_ANON_KEY || '';

function parseExamDate(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(t + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}$/.test(t)) {
    const d = new Date(t + '-01T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function daysUntilExam(raw) {
  const exam = parseExamDate(raw);
  if (!exam) return null;
  const dayMs = 86400000;
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startExam = new Date(exam.getFullYear(), exam.getMonth(), exam.getDate()).getTime();
  return Math.ceil((startExam - startToday) / dayMs);
}
function formatExamSessionLabel(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, mo, d] = t.split('-');
    return d + '/' + mo + '/' + y;
  }
  return t.replace('-', ' · ');
}
function examPhaseLabel(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) {
    return { icon: '📚', lbl: 'FONDATIONS', txt: 'Théorie + infractions' };
  }
  if (daysLeft < 0) {
    return { icon: '📌', lbl: 'POST-EXAMEN', txt: 'Période post-examen' };
  }
  if (daysLeft === 0) {
    return { icon: '🎯', lbl: 'JOUR J', txt: 'C\'est aujourd\'hui — bonne chance !' };
  }
  if (daysLeft <= 14) {
    return { icon: '🔥', lbl: 'SPRINT FINAL', txt: 'Examens blancs + ciblage lacunes' };
  }
  if (daysLeft <= 40) {
    return { icon: '⚡', lbl: 'INTENSIF', txt: 'Simulateur oral + exercices PV' };
  }
  return { icon: '📚', lbl: 'FONDATIONS', txt: 'Théorie + infractions' };
}

// Client Supabase
let supabaseClient = null;
let currentUser = null;
let syncTimeout = null;

// Initialiser Supabase
function initSupabase() {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[OPJ] Supabase initialisé');
    return true;
  }
  console.warn('[OPJ] Supabase SDK non chargé');
  return false;
}

// ─── AUTH FUNCTIONS ───
const AUTH = {
  // Inscription par email/password
  async signup(email, password, name) {
    if (!supabaseClient) return { error: { message: 'Supabase non initialisé' } };
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });
      if (error) return { error };
      // Mettre à jour le profil avec le nom
      if (data.user) {
        await supabaseClient.from('profiles').update({ name, email }).eq('id', data.user.id);
      }
      return { data };
    } catch (e) {
      return { error: { message: e.message } };
    }
  },

  // Connexion par email/password
  async login(email, password) {
    if (!supabaseClient) return { error: { message: 'Supabase non initialisé' } };
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) return { error };
      currentUser = data.user;
      return { data };
    } catch (e) {
      return { error: { message: e.message } };
    }
  },

  // Magic link (connexion sans mot de passe)
  async magicLink(email) {
    if (!supabaseClient) return { error: { message: 'Supabase non initialisé' } };
    try {
      const { data, error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      return { data, error };
    } catch (e) {
      return { error: { message: e.message } };
    }
  },

  // Déconnexion
  async logout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    currentUser = null;
    S = defaultState();
    save();
    showAuthScreen();
    showToast('Déconnecté', 'ok');
  },

  // Récupérer la session actuelle
  async getSession() {
    if (!supabaseClient) return null;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) currentUser = session.user;
    return session;
  },

  // Écouter les changements d'auth
  onAuthChange(callback) {
    if (!supabaseClient) return;
    supabaseClient.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      callback(event, session);
    });
  }
};

async function withSupabaseTimeout(promise, ms = 5000) {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error('supabase_timeout')), ms
    );
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timerId);
    return result;
  } catch (e) {
    clearTimeout(timerId);
    throw e;
  }
}

// ─── SYNC FUNCTIONS ───
const SYNC = {
  // Sauvegarder la progression dans Supabase
  async saveProgress() {
    if (!supabaseClient || !currentUser) return false;
    try {
      const { error } = await withSupabaseTimeout(
        supabaseClient.from('progress').upsert({
        user_id: currentUser.id,
        xp: S.user.xp,
        streak: S.user.streak,
        streak_record: S.user.streakRecord || 0,
        last_activity: S.user.lastActivity,
        sessions_done: S.user.sessionsDone || 0,
        qcm_cards: S.qcm.cards,
        lessons: S.lessons,
        fiches: S.fiches,
        badges: S.badges,
        activity: S.activity,
        shield: S.shield,
        annales_done: S.annalesDone,
        blitz_best: S.blitzBest || 0,
        cr_done: S.crDone || 0,
        tc_done: S.tcDone || 0,
        perfect_sessions: S.perfectSessions || 0,
        flash_fsrs: S.flashFsrs || {},
        oral_scores: S.oral || {},
        fs_due_session: S.fsDueSession,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      );
      if (error) console.warn('[SYNC] Erreur save:', error);
      else {
        try {
          localStorage.setItem('opje_sync_ts', String(Date.now()));
        } catch (_) {}
      }
      return !error;
    } catch (e) {
      if (e && e.message === 'supabase_timeout') {
        console.warn('[SYNC] supabase_timeout (saveProgress)');
        return false;
      }
      console.warn('[SYNC] Exception:', e);
      return false;
    }
  },

  // Charger la progression depuis Supabase
  async loadProgress() {
    if (!supabaseClient || !currentUser) return false;
    try {
      // Charger le profil
      let profile;
      try {
        const r = await withSupabaseTimeout(
          supabaseClient.from('profiles')
            .select('*').eq('id', currentUser.id).single()
        );
        profile = r.data;
      } catch (e) {
        if (e && e.message === 'supabase_timeout') console.warn('[SYNC] supabase_timeout (loadProgress profiles)');
        else throw e;
      }

      // Charger la progression
      let progress;
      try {
        const r = await withSupabaseTimeout(
          supabaseClient.from('progress')
            .select('*').eq('user_id', currentUser.id).single()
        );
        progress = r.data;
      } catch (e) {
        if (e && e.message === 'supabase_timeout') console.warn('[SYNC] supabase_timeout (loadProgress progress)');
        else throw e;
      }

      // Charger l'abonnement
      let sub;
      try {
        const r = await withSupabaseTimeout(
          supabaseClient.from('subscriptions')
            .select('*').eq('user_id', currentUser.id).single()
        );
        sub = r.data;
      } catch (e) {
        if (e && e.message === 'supabase_timeout') console.warn('[SYNC] supabase_timeout (loadProgress subscriptions)');
        else throw e;
      }

      if (profile) {
        S.user.name = profile.name || 'Officier';
        S.user.examDate = profile.exam_date || '2026-06-15';
      }
      if (progress) {
        const cloudTs = progress.updated_at ? new Date(progress.updated_at).getTime() : 0;
        let localTs = 0;
        try {
          localTs = Number(localStorage.getItem('opje_sync_ts') || 0);
        } catch (_) {}
        /* Nuage plus récent que la dernière sauvegarde locale : on applique la ligne progress (évite d'écraser le offline récent). */
        const cloudWins = cloudTs > localTs || (localTs === 0 && cloudTs === 0 && (progress.xp > 0 || (progress.qcm_cards && Object.keys(progress.qcm_cards).length)));
        if (cloudWins) {
          S.user.xp = progress.xp || 0;
          S.user.streak = progress.streak || 0;
          S.user.streakRecord = progress.streak_record || 0;
          S.user.lastActivity = progress.last_activity;
          S.user.sessionsDone = progress.sessions_done || 0;
          S.qcm.cards = progress.qcm_cards || {};
          S.lessons = progress.lessons || {};
          S.fiches = progress.fiches || {};
          S.badges = progress.badges || {};
          S.activity = progress.activity || {};
          S.shield = progress.shield || { count: 1, lastEarned: null };
          S.annalesDone = progress.annales_done || {};
          S.blitzBest = progress.blitz_best || 0;
          S.crDone = progress.cr_done || 0;
          S.tcDone = progress.tc_done || 0;
          S.perfectSessions = progress.perfect_sessions || 0;
          const parseJson = (v, fallback) => {
            if (v == null) return fallback;
            if (typeof v === 'string') {
              try {
                return JSON.parse(v);
              } catch (_) {
                return fallback;
              }
            }
            return v;
          };
          S.flashFsrs = parseJson(progress.flash_fsrs, S.flashFsrs || {});
          S.oral = parseJson(progress.oral_scores, S.oral || { done: {}, scores: {} });
          S.fsDueSession = parseJson(progress.fs_due_session, S.fsDueSession);
          try {
            localStorage.setItem('opje_sync_ts', String(cloudTs || Date.now()));
          } catch (_) {}
        }
      }
      if (sub) {
        S.isPro = sub.is_pro || false;
        S.user.isPRO = sub.is_pro || false;
        S.proExpiry = sub.expires_at;
        S.stripeCustId = sub.stripe_customer_id;
      }
      return true;
    } catch (e) {
      console.warn('[SYNC] Load error:', e);
      return false;
    }
  },

  // Mettre à jour le profil
  async updateProfile(name, examDate) {
    if (!supabaseClient || !currentUser) return false;
    try {
      const { error } = await supabaseClient.from('profiles').update({
        name, exam_date: examDate, updated_at: new Date().toISOString()
      }).eq('id', currentUser.id);
      return !error;
    } catch (e) { return false; }
  },

  // Sync debounced (évite trop d'appels)
  debouncedSave() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      SYNC.saveProgress();
    }, 2000); // Sync après 2s d'inactivité
  }
};

// ─── STRIPE — Edge Function create-checkout (Supabase) ───
const STRIPE = {
  async createCheckout(plan) {
    if (!currentUser) {
      showToast('Connectez-vous d\'abord', 'err');
      return;
    }
    if (!supabaseClient) {
      showToast('Supabase non disponible', 'err');
      return;
    }
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showToast('Session expirée — reconnectez-vous', 'err');
        return;
      }
      const res = await fetch('https://vwkymggfxgkfbbklkhhd.supabase.co/functions/v1/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ userId: currentUser.id, email: currentUser.email, plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || ('Erreur ' + res.status), 'err');
        return;
      }
      const url = data.url;
      if (url) window.location.href = url;
      else showToast('Réponse serveur invalide', 'err');
    } catch (e) {
      showToast('Erreur paiement: ' + e.message, 'err');
    }
  },

  // Vérifier le statut PRO
  async checkProStatus() {
    if (!supabaseClient || !currentUser) return false;
    const { data } = await supabaseClient.from('subscriptions')
      .select('is_pro, expires_at').eq('user_id', currentUser.id).single();
    if (data?.is_pro && new Date(data.expires_at) > new Date()) {
      S.isPro = true;
      S.user.isPRO = true;
      return true;
    }
    return false;
  }
};

/* ─── GRADES ─── défini dans js/data/annales.js (chargé avant app.js) */

/* ─── GRADES SVG (parcours habilitation — clés sk dans GRADES) ─── */
const GRADE_SVGS = {
  gp: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="11" fill="#070b15" stroke="#1b6bff" stroke-width="1.25"/><path d="M24 10.5l2.55 7.85h8.25L27.1 25.2l2.55 7.85L24 29.35l-5.65 4.1 2.55-7.85-5.65-4.1h8.25z" fill="#c8921a" stroke="#8f6a14" stroke-width="0.6" stroke-linejoin="round"/></svg>`,
  apj: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="11" fill="#070b15" stroke="#1b6bff" stroke-width="1"/><path d="M24 12l12 13h-4.8L24 17.2 16.8 25H12z" fill="#c8921a"/><path d="M24 23l12 13h-4.8L24 28.2 16.8 36H12z" fill="#c8921a"/></svg>`,
  'opj-s': `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="11" fill="#070b15" stroke="#1b6bff" stroke-width="1"/><path d="M24 7l10 11h-4L24 11.5 18 18h-4z" fill="#c8921a"/><path d="M24 15l10 11h-4L24 19.5 18 26h-4z" fill="#c8921a"/><path d="M24 23l10 11h-4L24 27.5 18 34h-4z" fill="#c8921a"/><rect x="4" y="39" width="40" height="6" rx="1.5" fill="#c8921a"/></svg>`,
  'opj-h': `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="11" fill="#070b15" stroke="#1b6bff" stroke-width="1"/><rect x="7" y="19" width="34" height="10" rx="2" fill="#c8921a"/></svg>`,
  'opj-n': `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="11" fill="#070b15" stroke="#1b6bff" stroke-width="1"/><rect x="7" y="15" width="34" height="8" rx="2" fill="#c8921a"/><rect x="7" y="26" width="34" height="8" rx="2" fill="#c8921a"/></svg>`,
  'opj-sp': `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="11" fill="#070b15" stroke="#c8921a" stroke-width="0.9"/><polygon points="12,9 13.4,12.2 12,15.4 10.6,12.2" fill="#c8921a"/><polygon points="24,9 25.4,12.2 24,15.4 22.6,12.2" fill="#c8921a"/><polygon points="36,9 37.4,12.2 36,15.4 34.6,12.2" fill="#c8921a"/><path d="M11 38.5L13.5 22h21l2.5 16.5z" fill="#1b6bff" stroke="#e8eeff" stroke-width="0.7"/><rect x="9" y="19.5" width="30" height="4" rx="1" fill="#c8921a"/><ellipse cx="24" cy="40" rx="15" ry="4.8" fill="#03060d" stroke="#c8921a" stroke-width="1.1"/></svg>`
};
function gradeSvg(g) {
  if (!g) return '';
  const k = g.sk || g.name;
  return GRADE_SVGS[k] || g.icon || '';
}

const PROFIL_STREAK_SVG='<svg class="pr-streak-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2c-1.2 3.2-5 4.8-5 9a5 5 0 1010 0c0-4.2-3.8-5.8-5-9z"/></svg>';

/* ─── ENTRAÎNEMENT ORAL CNJ ─── */
const ORAL_THEME_META = [
  { key: 'GAV', label: 'Garde à vue', emoji: '🔒' },
  { key: 'FLAGRANCE', label: 'Flagrance', emoji: '🚨' },
  { key: 'Cadres transitoires', label: 'Cadres transitoires', emoji: '⏳' },
  { key: 'PERQUIZ', label: 'Perquisitions', emoji: '🔍' },
  { key: 'MANDATS', label: 'Mandats', emoji: '📋' },
  { key: 'COMMISSION', label: 'Commission rogatoire', emoji: '📄' },
  { key: 'INFRACTIONS', label: 'Infractions principales', emoji: '⚡' },
  { key: 'TAJ', label: 'Fichiers police', emoji: '🗃️' },
  { key: 'QUALIF', label: 'Qualifications juridiques', emoji: '⚖️' },
  { key: 'LIBERTES', label: 'Libertés publiques', emoji: '🏛️' },
  { key: 'MINEURS', label: 'Mineurs', emoji: '👶' },
  { key: 'INSTRUCTION', label: 'Instruction', emoji: '📋' },
  { key: 'PREUVE', label: 'Preuve pénale', emoji: '🔬' },
  { key: 'NULLITES', label: 'Nullités', emoji: '❌' },
  { key: 'ALTERNATIVES', label: 'Alternatives aux poursuites', emoji: '🔄' },
  { key: 'TSE', label: 'Techniques spéciales', emoji: '🎧' },
  { key: 'INTERNATIONAL', label: 'Coopération internationale', emoji: '🌍' },
  { key: 'REQS', label: 'Réquisitions', emoji: '📨' },
  { key: 'RESPONSABILITE', label: 'Responsabilité agent', emoji: '⚠️' }
];
/* Banque orale : relecture juridique complète recommandée (OPJ formateur / magistrat). */
const ORAL_QB = [
  { id: 'oral_01', theme: 'GAV', q: 'Quelles sont les conditions de mise en garde à vue d\'une personne majeure ?', points: ['Cadre unique des conditions de placement : art. 62-2 CPP (infraction punie d\'emprisonnement + raisons plausibles + nécessité pour une des six finalités)', 'Décision écrite de l\'OPJ ; information immédiate du procureur (art. 63 et s. : durées, droits, prolongations — à ne pas confondre avec 62-2)', 'Ne pas citer à la place l\'art. 62 ou 62-1 CPP pour les conditions de la GAV'], articles: ['Art. 62-2 CPP'], niveau: 1, duree: 120 },
  { id: 'oral_02', theme: 'GAV', q: 'Quelle est la durée maximale de la garde à vue et comment se prolonge-t-elle ?', points: ['Droit commun : 24 h + 24 h sur autorisation écrite et motivée du PR (48 h max) — art. 63-3 CPP', 'Jusqu\'à 96 h en criminalité organisée : art. 706-88 CPP (contrôle du JLD au-delà de 48 h) — ne pas répondre « 706-23 »', 'Terrorisme : jusqu\'à 144 h — art. 706-88-1 CPP'], articles: ['Art. 706-88 CPP', 'Art. 63-3 CPP', 'Art. 706-88-1 CPP'], niveau: 1, duree: 120 },
  { id: 'oral_03', theme: 'GAV', q: 'Quels sont les droits fondamentaux de la personne gardée à vue (art. 63-1 CPP) ?', points: ['Droit d\'être assisté d\'un avocat', 'Droit au silence', 'Droit d\'être informé des motifs et droits', 'Droit à un examen médical'], articles: ['Art. 63-1 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_04', theme: 'GAV', q: 'Comment s\'effectue la notification de la garde à vue au procureur et aux proches ?', points: ['Information sans délai du procureur de la République', 'Information des proches si la personne le souhaite (sauf exceptions légales)', 'Mention dans la procès-verbal des notifications'], articles: ['Art. 63-1 CPP', 'Art. 63-4 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_05', theme: 'GAV', q: 'Quelles particularités pour la garde à vue d\'un mineur ?', points: ['CJPM : retenue judiciaire 10–13 ans (durée limitée, magistrat) ; GAV 13–18 ans selon seuils CJPM (ex. peine ≥ 5 ans pour 13–16 ans)', 'Représentation légale / autorité parentale ; droits adaptés (avocat, médecin, information des représentants)', 'Séparation des mineurs et des majeurs en cellule ; ne pas confondre avec le régime des majeurs (conditions GAV = art. 62-2 CPP uniquement)'], articles: ['CJPM art. L413-4', 'CJPM art. L413-6', 'Art. 63-1 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_06', theme: 'GAV', q: 'Qu\'est-ce que l\'audition de « première comparution » et son lien avec la GAV ?', points: ['Audition libre ou mesure coercitive selon le cadre : ne pas confondre audition et GAV', 'Si GAV : conditions cumulatives de l\'art. 62-2 CPP uniquement (pas les art. 62 ou 62-1 pour les conditions de placement)', 'PV, notification des droits (art. 63-1 si GAV), information du procureur'], articles: ['Art. 61-1 CPP', 'Art. 62-2 CPP', 'Art. 63-1 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_07', theme: 'GAV', q: 'Quand la garde à vue peut-elle être annulée ou entraîner des nullités ?', points: ['Vice de forme grave sur les droits (art. 63-1)', 'Durée dépassée sans prolongation valide', 'Conséquences sur la recevabilité des aveux selon jurisprudence'], articles: ['Art. 171 CPP', 'Art. 802 CPP'], niveau: 3, duree: 150 },
  { id: 'oral_08', theme: 'GAV', q: 'Quelles mesures peuvent accompagner la fin de garde à vue (mise en examen, contrôle judiciaire) ?', points: ['Orientation vers le parquet ou l\'instruction', 'Possibilité de garde à vue suivie de présentation au juge', 'Mesures alternatives selon qualification'], articles: ['Art. 72 CPP', 'Art. 137 CPP'], niveau: 3, duree: 150 },
  { id: 'oral_09', theme: 'FLAGRANCE', q: 'Qu\'est-ce que la flagrance au sens du CPP ?', points: ['Infraction en cours de commission', 'Infraction qui vient d\'être commise', 'Poursuite « hot pursuit » ou infraction considérée comme flagrante par la loi'], articles: ['Art. 53 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_10', theme: 'FLAGRANCE', q: 'Quels sont les pouvoirs spécifiques de l\'OPJ en flagrance ?', points: ['Perquisitions sans consentement sous conditions (art. 56)', 'Interruption de communications sous conditions', 'Actes d\'enquête urgents'], articles: ['Art. 54 CPP', 'Art. 56 CPP', 'Art. 77 CPP'], niveau: 1, duree: 120 },
  { id: 'oral_11', theme: 'FLAGRANCE', q: 'Différence entre enquête préliminaire et flagrance pour l\'OPJ ?', points: ['Flagrance = cadre matériel précis (art. 53)', 'EP = enquête sous autorité du parquet', 'Certaines mesures réservées ou facilitées en flagrance'], articles: ['Art. 75 CPP', 'Art. 76 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_12', theme: 'FLAGRANCE', q: 'Peut-on procéder à une garde à vue en procédure de flagrance ?', points: ['Oui si conditions cumulatives de l\'art. 62-2 CPP sont réunies', 'Peine d\'emprisonnement encourue + raisons plausibles + nécessité des mesures', 'Formalités identiques (notification droits art. 63-1, avis PR…)'], articles: ['Art. 62-2 CPP', 'Art. 63 CPP'], niveau: 2, duree: 90 },
  { id: 'oral_13', theme: 'FLAGRANCE', q: 'Qu\'est-ce que la « quasi-flagrance » ou infractions assimilées à la flagrance ?', points: ['Certaines hypothèses légales d\'équivalence', 'Intérêt pour pouvoir d\'intervention immédiat', 'Ne pas confondre avec simple soupçon'], articles: ['Art. 53 al. 4 CPP'], niveau: 3, duree: 120 },
  { id: 'oral_14', theme: 'FLAGRANCE', q: 'Que faire si la flagrance cesse avant la fin des actes ?', points: ['Adapter la procédure (EP, réquisitions)', 'Rechercher une autre base légale pour les actes', 'Conséquences sur la validité des perquisitions'], articles: ['Art. 76 CPP', 'Art. 56 CPP'], niveau: 3, duree: 150 },
  { id: 'oral_15', theme: 'PERQUIZ', q: 'Quelles sont les conditions générales de validité d\'une perquisition au domicile ?', points: ['Consentement du résident ou décision judiciaire selon cas', '6h–21h en droit commun (art. 59 CPP) sauf flagrance / CR / exceptions', 'Présence des garanties procédurales (PV, inventaire, art. 57 CPP si besoin)', 'Sans assentiment en préliminaire : crime ou délit puni d\'au moins 5 ans d\'emprisonnement — autorisation écrite et motivée du JLD (Art. 76 al.4 CPP)'], articles: ['Art. 56 CPP', 'Art. 59 CPP', 'Art. 76 al.4 CPP'], niveau: 1, duree: 120 },
  { id: 'oral_16', theme: 'PERQUIZ', q: 'Perquisition au lieu professionnel : particularités ?', points: ['Protection du secret professionnel (avocat, médecin…)', 'Mesures d\'interface avec le juge', 'Modalités d\'accès aux données'], articles: ['Art. 56 CPP', 'Art. 56-1 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_17', theme: 'PERQUIZ', q: 'Perquisition informatique : cadre et garanties ?', points: ['Saisie de données sous contrôle judiciaire selon hypothèses', 'Clonage, mots de passe, périmètre de fouille', 'Respect du secret des correspondances'], articles: ['Art. 706-95 et s. CPP'], niveau: 2, duree: 150 },
  { id: 'oral_18', theme: 'PERQUIZ', q: 'Différence entre perquisition et visite domiciliaire ?', points: ['Finalités et objets distincts', 'Régimes juridiques différents', 'Qui autorise et sous quelles conditions'], articles: ['Art. 76 CPP', 'Art. 59 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_19', theme: 'PERQUIZ', q: 'Que risque une perquisition irrégulière ?', points: ['Nullité selon gravité (art. 171)', 'Exclusion de preuves possibles', 'Responsabilité disciplinaire'], articles: ['Art. 171 CPP'], niveau: 3, duree: 120 },
  { id: 'oral_20', theme: 'MANDATS', q: 'Qu\'est-ce qu\'un mandat d\'arrêt et qui peut le décerner ?', points: ['Décision de justice pour conduire une personne devant le juge', 'Juge d\'instruction ou juridiction compétente selon phase', 'Différence avec autre mandat (comparution, amener)'], articles: ['Art. 122 CPP', 'Art. 167 CPP'], niveau: 1, duree: 120 },
  { id: 'oral_21', theme: 'MANDATS', q: 'Mandat d\'amener : définition et usage ?', points: ['Contraindre à comparaître', 'Conditions de délivrance', 'Exécution par les OPJ / services habilités'], articles: ['Art. 122 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_22', theme: 'MANDATS', q: 'Mandat de recherche national : en quoi diffère-t-il du mandat d\'arrêt (art. 131 CPP) ?', points: ['Mandat de recherche national → Art. 122-4 CPP (délivré par le PR si délit puni ≥ 3 ans)', 'MAE — Mandat d\'Arrêt Européen → Art. 695-11 CPP', '⚠️ Piège fréquent : Art. 694-1 CPP = entraide judiciaire internationale (pas le mandat national)'], articles: ['Art. 122-4 CPP', 'Art. 695-11 CPP'], niveau: 2, duree: 150 },
  { id: 'oral_23', theme: 'MANDATS', q: 'Comment exécuter un mandat sur le territoire (légitime défense, usage des moyens) ?', points: ['Identification des personnes', 'Respect des règles d\'usage de la force', 'Transmission au parquet / juge'], articles: ['Art. 78-2 CPP', 'Règlement intérieur'], niveau: 3, duree: 150 },
  { id: 'oral_24', theme: 'COMMISSION', q: 'Qu\'est-ce qu\'une commission rogatoire ?', points: ['Délégation d\'actes d\'instruction à un autre juge', 'Cadre de l\'instruction', 'Lettre rogatoire pour actes précis'], articles: ['Art. 81 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_25', theme: 'COMMISSION', q: 'Comment un OPJ intervient-il sur commission rogatoire ?', points: ['Actes exécutés sous contrôle du juge mandant', 'PV et transmission des résultats', 'Limites aux missions prescrites'], articles: ['Art. 81 CPP', 'Art. 151 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_26', theme: 'COMMISSION', q: 'Commission rogatoire internationale : principes ?', points: ['Entraide judiciaire', 'Canaux conventionnels / Union européenne', 'Respect du droit local et de la spécialité'], articles: ['Art. 694 CPP et s.'], niveau: 2, duree: 150 },
  { id: 'oral_27', theme: 'COMMISSION', q: 'Que se passe-t-il si l\'acte rogatoire dépasse le mandat ?', points: ['Risque de nullité ou irrecevabilité', 'Régularisation possible selon cas', 'Responsabilité procédurale'], articles: ['Art. 171 CPP'], niveau: 3, duree: 120 },
  { id: 'oral_28', theme: 'INFRACTIONS', q: 'Définir vol et escroquerie : éléments constitutifs principaux.', points: ['Vol : soustraction frauduleuse d\'un bien', 'Escroquerie : manoeuvre frauduleuse + obtenir un bien ou avantage', 'Distinction selon moyens et intention'], articles: ['Art. 311 CP', 'Art. 313 CP'], niveau: 1, duree: 120 },
  { id: 'oral_29', theme: 'INFRACTIONS', q: 'Violences volontaires avec et sans ITT : enjeux pour la qualification ?', points: ['Barème ITT pour circonstances aggravées', 'Différence coups et blessures / violences aggravées', 'Compétence de procédure'], articles: ['Art. 222-3 CP et s.'], niveau: 2, duree: 120 },
  { id: 'oral_30', theme: 'INFRACTIONS', q: 'Stupéfiants : détention vs trafic : critères pratiques ?', points: ['Quantité, emballage, argent, messages', 'Usage personnel vs revente', 'Infractions connexes (association, blanchiment)'], articles: ['Art. L. 3421-1 C.santé publique', 'Art. 222-37 CP'], niveau: 2, duree: 150 },
  { id: 'oral_31', theme: 'INFRACTIONS', q: 'Outrage et rébellion : distinction ?', points: ['Outrage : paroles / gestes à agent', 'Rébellion : violence ou menace pour résister', 'Sanctions et cadre procédural'], articles: ['Art. 433-5 CP', 'Art. 433-6 CP'], niveau: 2, duree: 120 },
  { id: 'oral_32', theme: 'INFRACTIONS', q: 'Infractions sexuelles : particularités d\'enquête (auditions, expertises) ?', points: ['Audition avec garanties (mineurs, psychologie)', 'Préservation des preuves biologiques', 'Cadre du consentement et violences'], articles: ['Art. 222-22 CP et s.'], niveau: 3, duree: 150 },
  { id: 'oral_33', theme: 'TAJ', q: 'Qu\'est-ce que le FNAU (TAJ) et à quoi sert-il pour l\'OPJ ?', points: ['Fichier des auteurs d\'infractions à caractère violent ou sexuel', 'Consultation sous conditions pour enquêtes', 'Protection des données et habilitations'], articles: ['Art. R. 53-10 CPP'], niveau: 1, duree: 120 },
  { id: 'oral_34', theme: 'TAJ', q: 'Quelles sont les principales bases de données police judiciaire accessibles à l\'OPJ ?', points: ['FPR, TAJ, fichiers spécialisés selon habilitation', 'Traçabilité des consultations', 'Finalité limitée à la mission'], articles: ['Code de la sécurité intérieure', 'Décrets d\'application'], niveau: 2, duree: 120 },
  { id: 'oral_35', theme: 'TAJ', q: 'Quelles obligations en cas de consultation ou d\'inscription au fichier ?', points: ['Information de la personne selon cas', 'Droit d\'accès / rectification (CNIL)', 'Conservation limitée dans le temps'], articles: ['Loi Informatique et libertés'], niveau: 2, duree: 120 },
  { id: 'oral_36', theme: 'TAJ', q: 'Risques en cas d\'usage abusif des fichiers ?', points: ['Responsabilité pénale et disciplinaire', 'Violation du secret professionnel', 'Atteinte à la vie privée'], articles: ['Art. 226-13 CP', 'Art. 226-21 CP'], niveau: 3, duree: 120 },
  { id: 'oral_37', theme: 'QUALIF', q: 'Cas : un individu arrache un sac et frappe la victime. Quelles qualifications possibles ?', points: ['Vol avec violence ou après violence selon circonstances', 'Coups et blessures éventuellement', 'Réunion d\'infractions / qualification unique selon analyse'], articles: ['Art. 311-4 CP', 'Art. 222-7 CP'], niveau: 2, duree: 150 },
  { id: 'oral_38', theme: 'QUALIF', q: 'Cas : effraction pour voler des outils dans un local fermé la nuit. Analyse juridique.', points: ['Vol avec effraction ou cambriolage selon éléments', 'Violation de domicile', 'Compétence et circonstances de nuit'], articles: ['Art. 311-4 CP', 'Art. 132-71 CP'], niveau: 2, duree: 150 },
  { id: 'oral_39', theme: 'QUALIF', q: 'Cas : altercation, insultes puis crachat sur un policier. Qualifications ?', points: ['Outrage à personne dépositaire d\'autorité publique', 'Rébellion si éléments de violence ou contrainte', 'Distinction des gestes et intention'], articles: ['Art. 433-5 CP'], niveau: 3, duree: 150 },
  { id: 'oral_40', theme: 'QUALIF', q: 'Cas : achat de plusieurs grammes de résine pour revente à des amis. Infractions ?', points: ['Usage vs trafic selon preuves', 'Infractions à la législation sur stupéfiants', 'Éventuelle association de malfaiteurs'], articles: ['Art. L. 3421-1 C.santé publique'], niveau: 3, duree: 150 },
  { id: 'oral_41', theme: 'LIBERTES', q: 'Quel est le fondement constitutionnel de la protection de la liberté individuelle ?', points: ['Art. 66 Constitution : autorité judiciaire gardienne', 'JLD garant des libertés', 'Habeas corpus à la française'], articles: ['Art. 66 Constitution'], niveau: 1, duree: 90 },
  { id: 'oral_42', theme: 'LIBERTES', q: 'Comment la présomption d\'innocence s\'articule-t-elle avec la GAV et la DP ?', points: ['Art. 9 DDHC / Art. 6§2 CEDH', 'Mesures conservatoires ≠ condamnation', 'Charge de la preuve sur le ministère public'], articles: ['Art. 9 DDHC', 'Art. 6 CEDH'], niveau: 2, duree: 120 },
  { id: 'oral_43', theme: 'LIBERTES', q: 'Quel est le contenu de l\'article 3 CEDH et pourquoi est-il qualifié d\'absolu ?', points: ['Interdiction de la torture et traitements inhumains', 'Aucune dérogation même en guerre ou terrorisme', 'Contrôle de la CEDH sur les conditions de détention'], articles: ['Art. 3 CEDH'], niveau: 2, duree: 120 },
  { id: 'oral_44', theme: 'LIBERTES', q: 'Comment le droit à la vie privée (art. 8 CEDH) limite-t-il les TSE ?', points: ['Proportionnalité entre atteinte et but poursuivi', 'Autorisation judiciaire préalable obligatoire', 'Contrôle a posteriori par la chambre de l\'instruction'], articles: ['Art. 8 CEDH'], niveau: 3, duree: 150 },
  { id: 'oral_45', theme: 'LIBERTES', q: 'Quelles sont les garanties du droit au procès équitable (art. 6 CEDH) applicables à l\'enquête ?', points: ['Droit à l\'avocat dès la privation de liberté', 'Droit au silence', 'Égalité des armes entre accusation et défense'], articles: ['Art. 6 CEDH'], niveau: 2, duree: 120 },
  { id: 'oral_46', theme: 'MINEURS', q: 'Quels sont les seuils d\'âge en matière de responsabilité pénale des mineurs ?', points: ['<10 ans : irresponsabilité totale', '10-13 ans : présomption irréfragable, retenue 12h', '13-18 ans : responsabilité atténuée, GAV possible'], articles: ['CJPM 2021', 'Art. L413-6'], niveau: 1, duree: 90 },
  { id: 'oral_47', theme: 'MINEURS', q: 'Quelles sont les conditions de GAV d\'un mineur de 14 ans ?', points: ['Infraction punie d\'au moins 5 ans', 'Durée 24h non renouvelable', 'Avocat immédiat, médecin obligatoire, parents informés'], articles: ['CJPM'], niveau: 2, duree: 120 },
  { id: 'oral_48', theme: 'MINEURS', q: 'Qu\'est-ce que la retenue judiciaire pour les 10-13 ans ?', points: ['Durée max 12h non renouvelable', 'Accord du PR ou du JI', 'Parents informés, avocat, médecin obligatoire'], articles: ['Art. L413-6 CJPM'], niveau: 2, duree: 120 },
  { id: 'oral_49', theme: 'MINEURS', q: 'Comment le CJPM 2021 a-t-il remplacé l\'ordonnance de 1945 ?', points: ['Entrée en vigueur le 30 septembre 2021', 'Codification et modernisation', 'Primauté de l\'éducatif maintenue'], articles: ['CJPM 2021'], niveau: 1, duree: 90 },
  { id: 'oral_50', theme: 'MINEURS', q: 'Quelles mesures éducatives peuvent être prononcées pour un mineur ?', points: ['Admonestation, remise aux parents', 'Placement en centre éducatif', 'Travail d\'intérêt général adapté, réparation'], articles: ['CJPM'], niveau: 2, duree: 120 },
  { id: 'oral_51', theme: 'INSTRUCTION', q: 'Comment le juge d\'instruction est-il saisi ?', points: ['Réquisitoire introductif du PR', 'Plainte avec constitution de partie civile', 'Dessaisissement d\'un autre JI'], articles: ['Art. 80 CPP', 'Art. 85 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_52', theme: 'INSTRUCTION', q: 'Qu\'est-ce que la mise en examen et quelles en sont les conditions ?', points: ['Indices graves ou concordants', 'Notification par le JI en personne', 'Droits : avocat, silence, accès au dossier'], articles: ['Art. 80-1 CPP', 'Art. 116 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_53', theme: 'INSTRUCTION', q: 'Quelles sont les ordonnances de clôture du JI ?', points: ['Ordonnance de non-lieu', 'Ordonnance de renvoi devant le tribunal correctionnel', 'Ordonnance de mise en accusation devant les assises'], articles: ['Art. 175 CPP', 'Art. 177 CPP', 'Art. 181 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_54', theme: 'INSTRUCTION', q: 'Quel est le rôle de la chambre de l\'instruction ?', points: ['Appel des ordonnances du JI', 'Contrôle de la régularité de la procédure', 'Peut annuler des actes (nullités art. 173)'], articles: ['Art. 191 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_55', theme: 'INSTRUCTION', q: 'Quelle est la différence entre témoin assisté et mis en examen ?', points: ['Témoin assisté : indices insuffisants, droits limités', 'Mis en examen : indices graves, tous les droits de la défense', 'Le JI peut requalifier le statut en cours d\'instruction'], articles: ['Art. 113-1 CPP', 'Art. 80-1 CPP'], niveau: 3, duree: 150 },
  { id: 'oral_56', theme: 'PREUVE', q: 'Quel est le principe de liberté de la preuve en matière pénale ?', points: ['Art. 427 CPP : tout mode de preuve admissible', 'Charge de la preuve sur le ministère public', 'Exception : certaines infractions à preuve réglementée'], articles: ['Art. 427 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_57', theme: 'PREUVE', q: 'Qu\'est-ce que le principe de loyauté de la preuve ?', points: ['Interdiction des stratagèmes et provocations policières', 'Provocation à la commission d\'infraction = nullité', 'Distinction provocation à la preuve vs provocation à l\'infraction'], articles: ['Jurisprudence Cass. crim.'], niveau: 2, duree: 120 },
  { id: 'oral_58', theme: 'PREUVE', q: 'L\'aveu est-il la reine des preuves en droit pénal français ?', points: ['Non : libre appréciation par le juge', 'L\'aveu peut être rétracté', 'Le juge n\'est jamais lié par l\'aveu seul'], articles: ['Art. 428 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_59', theme: 'PREUVE', q: 'Que signifie l\'intime conviction du juge ?', points: ['Appréciation souveraine des preuves au terme du débat contradictoire', 'Obligation de motivation de la décision', 'Pas de hiérarchie légale entre les preuves'], articles: ['Art. 353 CPP', 'Art. 427 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_60', theme: 'PREUVE', q: 'Une preuve obtenue illégalement peut-elle être utilisée ?', points: ['Principe : exclusion si atteinte aux droits fondamentaux', 'Nuance : preuve apportée par un particulier parfois admise', 'Contrôle de proportionnalité par le juge'], articles: ['Art. 427 CPP', 'CEDH art. 6'], niveau: 3, duree: 150 },
  { id: 'oral_61', theme: 'NULLITES', q: 'Quelle est la différence entre nullité textuelle et nullité substantielle ?', points: ['Textuelle (171) : automatique dès violation d\'un texte', 'Substantielle (802) : exige la preuve d\'un grief', 'Textuelle = pas besoin de grief'], articles: ['Art. 171 CPP', 'Art. 802 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_62', theme: 'NULLITES', q: 'Qu\'est-ce que la purge des nullités en instruction ?', points: ['Art. 173-1 : délai de 6 mois pour soulever les nullités', 'Passé ce délai, les nullités sont couvertes', 'Objectif : sécurité juridique de la procédure'], articles: ['Art. 173-1 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_63', theme: 'NULLITES', q: 'Quel est l\'effet de l\'annulation d\'un acte sur les actes subséquents ?', points: ['Art. 174 : annulation des actes dont l\'acte nul est le support nécessaire', 'Théorie du fruit de l\'arbre empoisonné', 'Le JI peut refaire les actes annulés si possible'], articles: ['Art. 174 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_64', theme: 'NULLITES', q: 'Quand faut-il soulever les nullités devant le tribunal ?', points: ['In limine litis : avant tout débat sur le fond', 'Art. 385 CPP : forclusion si soulevé après', 'Exception : moyens d\'ordre public'], articles: ['Art. 385 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_65', theme: 'NULLITES', q: 'Un OPJ peut-il être personnellement mis en cause pour une nullité de procédure ?', points: ['La nullité ne vise que l\'acte, pas l\'agent', 'Responsabilité disciplinaire possible (IGPN)', 'Responsabilité pénale si faute personnelle détachable'], articles: ['Art. 13 CPP'], niveau: 3, duree: 150 },
  { id: 'oral_66', theme: 'ALTERNATIVES', q: 'Qu\'est-ce que la composition pénale (art. 41-2 CPP) ?', points: ['Alternative aux poursuites proposée par le PR', 'Mesures : amende, TIG, stage, remise permis', 'Homologation par le juge obligatoire'], articles: ['Art. 41-2 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_67', theme: 'ALTERNATIVES', q: 'Comment fonctionne la CRPC (comparution sur reconnaissance préalable de culpabilité) ?', points: ['PR propose une peine après aveu de culpabilité', 'Homologation par le juge du siège', 'Impossible pour les crimes et les mineurs'], articles: ['Art. 495-7 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_68', theme: 'ALTERNATIVES', q: 'Qu\'est-ce que le rappel à la loi et existe-t-il encore ?', points: ['Art. 41-1 1° CPP : rappel des obligations légales', 'Réforme 2023 : transformation en \'avertissement pénal probatoire\'', 'Simple mesure du PR sans inscription au casier'], articles: ['Art. 41-1 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_69', theme: 'ALTERNATIVES', q: 'Qu\'est-ce que l\'amende forfaitaire délictuelle (AFD) ?', points: ['Applicable à certains délits (usage stups, occupation halls)', '200 € forfaitaire pour usage de stupéfiants', 'Pas de passage devant le tribunal si paiement'], articles: ['Art. 495-17 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_70', theme: 'ALTERNATIVES', q: 'Quelle est la différence entre médiation pénale et composition pénale ?', points: ['Médiation (41-1 5°) : accord auteur-victime, réparation', 'Composition (41-2) : mesures imposées par le PR, homologuées', 'La médiation est plus consensuelle, la composition plus directive'], articles: ['Art. 41-1 CPP', 'Art. 41-2 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_71', theme: 'TSE', q: 'Qui autorise les écoutes téléphoniques et pour quelle durée ?', points: ['Instruction : JI pour 4 mois renouvelables (art. 100)', 'Préliminaire CO : JLD pour 1 mois renouvelable (706-95)', 'Transcription des éléments utiles uniquement'], articles: ['Art. 100 CPP', 'Art. 706-95 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_72', theme: 'TSE', q: 'Quel est le régime de la géolocalisation (art. 230-32 CPP) ?', points: ['PR autorise pour 15 jours', 'Au-delà : autorisation du JLD pour 1 mois', 'En instruction : ordonnance du JI'], articles: ['Art. 230-32 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_73', theme: 'TSE', q: 'Qu\'est-ce que l\'infiltration et quelles infractions la permettent ?', points: ['Agent sous identité d\'emprunt intégrant un réseau', 'Réservée à la criminalité organisée (706-73)', 'PR ou JI, 4 mois renouvelables, identité protégée'], articles: ['Art. 706-81 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_74', theme: 'TSE', q: 'Qu\'est-ce qu\'un IMSI-catcher et qui l\'autorise ?', points: ['Dispositif captant les identifiants des téléphones à proximité', 'Autorisé par le JLD', 'Usage encadré : courte durée, CO uniquement'], articles: ['Art. 706-95-20 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_75', theme: 'TSE', q: 'La sonorisation de lieux privés est-elle possible en enquête préliminaire ?', points: ['Non : réservée à l\'instruction (JI uniquement)', 'Uniquement pour la criminalité organisée', 'Art. 706-96 CPP : ordonnance motivée du JI'], articles: ['Art. 706-96 CPP'], niveau: 3, duree: 120 },
  { id: 'oral_76', theme: 'INTERNATIONAL', q: 'Qu\'est-ce que le mandat d\'arrêt européen (MAE) ?', points: ['Système d\'extradition simplifié entre États UE', 'Remplace l\'extradition classique intra-UE', 'Art. 695-11 CPP : conditions et motifs de refus'], articles: ['Art. 695-11 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_77', theme: 'INTERNATIONAL', q: 'Quel est le rôle d\'EUROPOL ?', points: ['Coordination des services de police européens', 'Pas de pouvoir d\'arrestation propre', 'Analyse criminelle, bases de données partagées'], articles: ['Règlement EUROPOL'], niveau: 2, duree: 120 },
  { id: 'oral_78', theme: 'INTERNATIONAL', q: 'Comment fonctionne l\'entraide judiciaire pénale internationale ?', points: ['Conventions bilatérales et multilatérales', 'Canaux : ministère de la Justice, Eurojust', 'Commission rogatoire internationale'], articles: ['Art. 694 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_79', theme: 'INTERNATIONAL', q: 'Qu\'est-ce que le principe de spécialité en extradition ?', points: ['L\'État requérant ne peut poursuivre que pour les faits visés par la demande', 'Protection contre les poursuites non autorisées', 'Exception : consentement de l\'État requis'], articles: ['Convention européenne d\'extradition'], niveau: 3, duree: 150 },
  { id: 'oral_80', theme: 'INTERNATIONAL', q: 'Quel est le rôle d\'Eurojust ?', points: ['Coordination des enquêtes transfrontalières', 'Facilitation des CR internationales', 'Ne remplace pas les autorités nationales'], articles: ['Règlement Eurojust'], niveau: 2, duree: 120 },
  { id: 'oral_81', theme: 'REQS', q: 'Quelle est la base légale des réquisitions en flagrance ?', points: ['Art. 60 CPP : réquisition de toute personne qualifiée', 'Sans autorisation préalable', 'Examen technique, médecin légiste, serrurier'], articles: ['Art. 60 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_82', theme: 'REQS', q: 'Quelle est la base légale des réquisitions en enquête préliminaire ?', points: ['Art. 77-1 CPP : avec autorisation du PR', 'Art. 77-1-1 : réquisitions aux administrations et opérateurs', 'Distinction avec la flagrance : autorisation nécessaire'], articles: ['Art. 77-1 CPP', 'Art. 77-1-1 CPP'], niveau: 1, duree: 90 },
  { id: 'oral_83', theme: 'REQS', q: 'Que risque celui qui refuse de déférer à une réquisition ?', points: ['Art. 60-2 CPP : amende de 3 750 €', 'Obligation de coopérer avec la justice', 'Exception : secret professionnel (avocat)'], articles: ['Art. 60-2 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_84', theme: 'REQS', q: 'Quelle est la différence entre réquisition (OPJ) et expertise (JI) ?', points: ['Réquisition : acte d\'enquête, pas de contradictoire', 'Expertise : acte d\'instruction, débat contradictoire', 'L\'expert est nommé par le JI, le requis par l\'OPJ'], articles: ['Art. 60 CPP', 'Art. 156 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_85', theme: 'REQS', q: 'L\'OPJ peut-il requérir les opérateurs téléphoniques pour obtenir des fadettes ?', points: ['En flagrance : oui directement (art. 60)', 'En préliminaire : avec autorisation du PR (77-1-1)', 'Fadettes ≠ écoutes : pas besoin de JI pour les facturations détaillées'], articles: ['Art. 77-1-1 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_86', theme: 'RESPONSABILITE', q: 'Qu\'est-ce que la détention arbitraire (art. 432-4 CP) ?', points: ['Agent public qui ordonne/prolonge une détention sans droit', 'Peine : 7 ans d\'emprisonnement', 'Libération : réduction de peine possible si libération volontaire'], articles: ['Art. 432-4 CP'], niveau: 1, duree: 90 },
  { id: 'oral_87', theme: 'RESPONSABILITE', q: 'Quelle est la différence entre faute de service et faute personnelle de l\'OPJ ?', points: ['Faute de service : responsabilité de l\'État (administrative)', 'Faute personnelle détachable : responsabilité pénale individuelle', 'Cumul possible dans certains cas'], articles: ['Jurisprudence CE'], niveau: 2, duree: 120 },
  { id: 'oral_88', theme: 'RESPONSABILITE', q: 'Quel est le rôle de l\'IGPN dans le contrôle de la police ?', points: ['Enquêtes administratives sur les manquements professionnels', 'Enquêtes judiciaires sous l\'autorité du parquet', 'Ne peut pas prononcer de sanctions pénales directement'], articles: ['CSI'], niveau: 2, duree: 120 },
  { id: 'oral_89', theme: 'RESPONSABILITE', q: 'Un OPJ peut-il être poursuivi pour violences en opération ?', points: ['Oui si usage disproportionné de la force', 'Art. 122-5 CP : légitime défense comme fait justificatif', 'Art. L435-1 CSI : cadre légal de l\'usage des armes'], articles: ['Art. 122-5 CP', 'Art. L435-1 CSI'], niveau: 3, duree: 150 },
  { id: 'oral_90', theme: 'RESPONSABILITE', q: 'Quelles sanctions disciplinaires peut subir un OPJ ?', points: ['Avertissement, blâme, exclusion temporaire', 'Suspension ou retrait de l\'habilitation OPJ par la chambre de l\'instruction', 'Sanctions administratives distinctes des sanctions pénales'], articles: ['Art. 13 CPP', 'Statut PN'], niveau: 2, duree: 120 },
  { id: 'oral_ct_01', theme: 'Cadres transitoires', q: 'Dans quelles conditions ouvre-t-on une enquête pour mort suspecte ou cause inconnue ?', points: ['Découverte d\'un cadavre dont la cause de mort est inconnue, suspecte ou violente', 'OPJ informe immédiatement le PR (Art. 74 CPP)', 'Investigations pour établir les causes et circonstances du décès', 'Réquisitions pour autopsie possibles (expert médico-légal)', 'GAV possible si nécessaire dans ce cadre'], articles: ['Art. 74 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_ct_02', theme: 'Cadres transitoires', q: 'Quelle est la procédure en cas de disparition inquiétante ?', points: ['Disparition d\'un mineur ou d\'un majeur protégé (Art. 74-1 CPP)', 'Ou toute personne dans des circonstances inquiétantes ou suspectes laissant craindre une infraction', 'OPJ informe le PR sans délai', 'Investigations immédiates : dernier lieu connu, témoins, téléphonie, CCTV', 'Plan alerte enlèvement si conditions réunies'], articles: ['Art. 74-1 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_ct_03', theme: 'Cadres transitoires', q: 'Comment agit l\'OPJ face à une personne grièvement blessée dont la vie est en danger ?', points: ['Cadre Art. 74 al.6 CPP : personne grièvement blessée dont les jours sont en danger', 'OPJ peut procéder à toutes constatations utiles', 'Investigations pour déterminer les circonstances', 'Avis immédiat au PR', 'Si infraction caractérisée : ouverture du cadre flagrance ou préliminaire selon les éléments'], articles: ['Art. 74 al.6 CPP'], niveau: 2, duree: 120 },

  /* ── Programme OPJ — compléments par module (oral_mNN_XX) ── */
  { id: 'oral_m01_01', theme: 'INSTRUCTION', q: 'Qu\'est-ce que l\'action publique et en quoi diffère-t-elle de l\'action civile ?', points: ['Action publique : mise en mouvement de la répression pénale par les autorités compétentes (ministère public, partie civile dans les cas prévus)', 'Action civile : réparation du préjudice devant la juridiction répressive (demandes devant le tribunal correctionnel ou la cour d\'assises selon les cas)', 'L\'action publique peut s\'éteindre par prescription, amnistie, décision de poursuite ou de classement, sans préjuger des droits civils'], articles: ['Art. 1 CPP', 'Art. 2 CPP', 'Art. 3 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m01_02', theme: 'INSTRUCTION', q: 'Quelles décisions le procureur de la République peut-il prendre à l\'issue de l\'enquête (grandes voies) ?', points: ['Classer sans suite (art. 40-1 CPP) si les infractions ne sont pas suffisamment caractérisées ou si les poursuites sont inopportunes', 'Engager des poursuites (citations, renvois, réquisitions devant le juge d\'instruction ou le tribunal selon les cas)', 'Proposer ou ordonner des mesures alternatives aux poursuites (art. 41-1 CPP : rappel à la loi, médiation, etc. ; art. 41-2 composition pénale sous conditions)', 'Le PR dirige l\'enquête préliminaire et l\'enquête de flagrance sur le plan juridique'], articles: ['Art. 40 CPP', 'Art. 40-1 CPP', 'Art. 41-1 CPP', 'Art. 41-2 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m01_03', theme: 'NULLITES', q: 'Comment distinguer nullités « automatiques », nullités « substantielles » et nullités d\'intérêt privé ?', points: ['Nullité « textuelle » (art. 171 CPP) : sanction attachée par la loi à l\'inobservation d\'une formalité — nullité sans preuve de grief dans les cas visés', 'Nullité « substantielle » (art. 802 CPP) : irrégularité susceptible d\'avoir porté atteinte aux intérêts de la partie : grief à établir', 'Nullités d\'intérêt privé : certaines irrégularités ne peuvent être invoquées que par la personne concernée (prévenu, partie civile) et non par le ministère public — à ne pas confondre avec l\'ordre public procédural', 'Art. 803 et suivants CPP : cadre des conclusions en nullité devant la cour d\'assises (nullités invoquées par les parties)'], articles: ['Art. 171 CPP', 'Art. 802 CPP', 'Art. 803 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m01_04', theme: 'QUALIF', q: 'Quels sont les délais ordinaires de prescription de l\'action publique pour crime, délit et contravention ?', points: ['Crimes : prescription vingt ans (art. 133-1 CP) — nuances pour crimes contre l\'humanité et certaines infractions spéciales', 'Délit : prescription six ans (art. 133-2 CP) sauf dispositions spéciales plus courtes ou plus longues', 'Contravention : prescription trois ans (art. 133-3 CP)', 'Point d\'articulation avec l\'interruption et la suspension (art. 133-4 à 133-6 CP)'], articles: ['Art. 133-1 CP', 'Art. 133-2 CP', 'Art. 133-3 CP'], niveau: 2, duree: 120 },
  { id: 'oral_m01_05', theme: 'QUALIF', q: 'Qu\'est-ce que la tentative et la complicité en droit pénal ?', points: ['Tentative — définition (art. 121-5 CP) : commencement d\'exécution + absence de désistement volontaire (causes indépendantes de la volonté) ; punissabilité (art. 121-4 CP) : peines réduites sauf cas où la tentative est punie comme l\'infraction consommée', 'Complicité (art. 121-7 CP) : aide ou assistance à l\'infraction ; fourniture moyens, provocation, intelligence selon les cas', 'Distinction instigateur / complice / coauteur selon le rôle dans les faits', 'Complicité de contravention : conditions restrictives (art. 121-7 al. 3 CP)'], articles: ['Art. 121-5 CP (définition), Art. 121-4 CP (punissabilité)', 'Art. 121-7 CP'], niveau: 2, duree: 120 },

  { id: 'oral_m02_01', theme: 'FLAGRANCE', q: 'Comment l\'article 18 CPP organise-t-il les déplacements des OPJ hors de leur ressort territorial (extension de compétence) ?', points: ['Al. 1 : compétence dans les limites territoriales où l\'OPJ exerce habituellement ses fonctions', 'Al. 2 : OPJ temporairement mis à disposition d\'un autre service = même compétence territoriale que les OPJ du service d\'accueil', 'Al. 3 : transport sur **tout le territoire national** pour enquêter (auditions, perquisitions, saisies) après information du **procureur saisi de l\'enquête** ou du **juge d\'instruction** ; assistance d\'un OPJ territorialement compétent si le magistrat le décide ; information du procureur du TJ du lieu des actes', 'Cas **limitrophe** : **aucune information préalable** requise si le déplacement reste dans un ressort limitrophe au sien — **Paris** et **Hauts-de-Seine, Seine-Saint-Denis, Val-de-Marne** assimilés à un seul département (fin al. 3)', 'À relier à l\'information du procureur en flagrance (art. 53 CPP)'], articles: ['Art. 18 CPP', 'Art. 53 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m02_02', theme: 'FLAGRANCE', q: 'Quelle est la durée maximale de l\'enquête de flagrance et comment la prolonge-t-on ?', points: ['Durée initiale : huit jours sans discontinu à compter de la constatation de la flagrance (art. 53 CPP)', 'Prolongation : huit jours supplémentaires possibles par décision écrite du procureur si enquêtes nécessaires à la manifestation de la vérité pour crime ou délit puni d\'au moins cinq ans d\'emprisonnement ne peuvent être différées (art. 53 CPP)', 'Au-delà : les actes relèvent des règles de l\'enquête préliminaire sous peine de nullité', 'Ne pas confondre avec la seule durée de la garde à vue (régime des art. 63 et s. CPP)'], articles: ['Art. 53 CPP'], niveau: 2, duree: 120 },

  { id: 'oral_m03_01', theme: 'PERQUIZ', q: 'En enquête préliminaire, quel est le régime de l\'assentiment pour perquisition au domicile (art. 76 CPP) ?', points: ['Principe : perquisition, visite domiciliaire ou saisie sans assentiment exprès de l\'occupant est interdite', 'Assentiment : déclaration écrite de la main de l\'intéressé ; si la personne ne sait pas écrire, mention au procès-verbal (art. 76 al. 2 CPP)', 'Exception : crime ou délit puni d\'au moins cinq ans — le juge des libertés peut autoriser l\'opération sans assentiment sur réquisition motivée du procureur (art. 76 al. 4 CPP)', 'Distinction avec le régime de la flagrance (art. 56 et s. CPP)'], articles: ['Art. 76 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m03_02', theme: 'INSTRUCTION', q: 'Quelle est la durée maximale de rétention d\'un témoin qui n\'est pas suspect (art. 78 CPP) ?', points: ['Personne à l\'encontre de laquelle il n\'existe pas de raisons plausibles de soupçonner qu\'elle a commis une infraction : rétention le temps strictement nécessaire à son audition', 'Plafond : quatre heures (art. 78 CPP)', 'Si des indices apparaissent : placement éventuel en garde à vue sous le seul régime de l\'art. 62-2 CPP si conditions réunies', 'Formalités d\'audition et PV conformes aux règles d\'enquête'], articles: ['Art. 78 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m03_03', theme: 'MANDATS', q: 'Qu\'est-ce que le mandat de recherche en enquête préliminaire ou de flagrance et qui le décerne ?', points: ['Ordre donné à la force publique de rechercher une personne et de la placer en garde à vue si elle est localisée', 'Décerné par le procureur de la République lorsque les nécessités de l\'enquête sur crime ou délit flagrant puni d\'au moins trois ans l\'exigent et qu\'il existe des raisons plausibles de soupçon (art. 70 CPP)', 'Ne pas confondre avec le mandat d\'arrêt délivré par le juge d\'instruction (art. 122 CPP) ni avec le mandat de recherche national (art. 122-4 CPP)', 'Exclusions : personne déjà mise en examen, témoin assisté ou visée par réquisitoire selon le texte'], articles: ['Art. 70 CPP', 'Art. 122 CPP'], niveau: 2, duree: 120 },

  { id: 'oral_m04_01', theme: 'COMMISSION', q: 'Quelles mentions et formalismes doit respecter une commission rogatoire délivrée par le juge d\'instruction ?', points: ['Décision écrite du juge d\'instruction désignant l\'officier ou agent de police judiciaire ou le juge commis', 'Mention de la juridiction, date, signature et sceau (formalisme des actes d\'instruction — arts. 81 et 151 CPP et suite)', 'Périmètre précis des actes délégués et délai de renvoi des pièces ; à défaut de délai fixé, transmission sous huit jours en fin d\'opérations (art. 151 CPP)', 'Une commission incomplète ou vague peut entraîner nullité ou actes hors mandat'], articles: ['Art. 81 CPP', 'Art. 151 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m04_02', theme: 'COMMISSION', q: 'Quels actes l\'OPJ ne peut-il pas exécuter sur simple commission rogatoire (limites de l\'art. 152 CPP) ?', points: ['L\'OPJ exécute la CR dans les limites prescrites avec les pouvoirs du juge d\'instruction sauf réserves légales (art. 152 CPP)', 'Interdiction d\'interroger ou de confronter une personne **mise en examen**', 'Interdiction d\'auditionner la partie civile ou le **témoin assisté**, sauf à la demande de ceux-ci', 'Mandats d\'arrêt, expertise ordonnée par le JI, actes réservés au magistrat : hors délégation sauf texte spécial', 'Dépassement du mandat : risque de nullité (art. 171 CPP)'], articles: ['Art. 152 CPP', 'Art. 171 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m04_03', theme: 'COMMISSION', q: 'Après exécution d\'une commission rogatoire par l\'OPJ, que doit-il transmettre au juge mandant ?', points: ['Procès-verbaux et pièces afférentes aux actes accomplis dans le délai fixé par le juge, ou à défaut dans les huit jours (art. 151 CPP)', 'Obligation de produire les **originaux** des scellés et pièces saisies lorsque la loi ou le juge l\'exigent — copies certifiées seulement si le mandat le prévoit', 'Rapport fidèle et complet : pas d\'actes « en plus » sans nouveau titre', 'Transmission traçable au dossier d\'instruction'], articles: ['Art. 151 CPP', 'Art. 152 CPP'], niveau: 2, duree: 120 },

  { id: 'oral_m07_01', theme: 'QUALIF', q: 'Comment distinguer la « bande organisée » (art. 132-71 CP) et l\'« association de malfaiteurs » (art. 450-1 CP) ?', points: ['Bande organisée : groupement ou entente en vue de la préparation caractérisée par des faits matériels d\'**une ou plusieurs infractions punies d\'au moins cinq ans** d\'emprisonnement (art. 132-71 CP) — souvent circonstance aggravante d\'une infraction de fond', 'Association de malfaiteurs : groupement ou entente en vue de la préparation, caractérisée par des faits matériels, d\'**un crime ou d\'un délit** (sans seuil des cinq ans) — infraction autonome (art. 450-1 CP)', 'Sanctions et procédures spéciales (706-73 CPP) liées à la criminalité organisée pour la bande organisée', 'Ne pas confondre avec la simple « réunion » (circ. art. 132-71 vs réunion d\'infractions)'], articles: ['Art. 132-71 CP', 'Art. 450-1 CP'], niveau: 2, duree: 120 },
  { id: 'oral_m07_02', theme: 'TSE', q: 'Qu\'est-ce qu\'une JIRS et sur quels textes s\'appuie-t-elle ?', points: ['Juridiction interrégionale spécialisée : compétence pour certaines infractions graves (criminalité organisée, délinquance économique et financière selon les cas)', 'Compétence matérielle notamment infractions relevant des art. 706-73, 706-73-1 et 706-74 CPP', 'Compétence territoriale et dessaisissement au profit de la JIRS encadrés par les art. 706-75 et suivants CPP (ex. 706-77 : réquisitions du parquet)', 'L\'OPJ peut être amené à transmettre des dossiers ou à exécuter des actes dans ce cadre sous direction du parquet et du juge'], articles: ['Art. 706-73 CPP', 'Art. 706-75 CPP', 'Art. 706-77 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m07_03', theme: 'TSE', q: 'Qu\'encadre l\'article 706-102-1 CPP (captation de données informatiques) ?', points: ['Technique d\'enquête en matière de criminalité et délinquance organisées (champ des art. 706-73 et 706-73-1 CPP)', 'Autorisation par ordonnance motivée du **juge d\'instruction**, après avis du procureur ; mise en œuvre sous contrôle du JI', 'Finalité : accès, enregistrement, conservation ou transmission de données informatiques — y compris captation à l\'écran ou saisies clavier selon le dispositif technique autorisé', 'Fichiers et traitements ultérieurs encadrés par décret (protection des données)', 'Ne pas confondre avec la simple perquisition informatique (art. 706-95 et s. CPP)'], articles: ['Art. 706-102-1 CPP', 'Art. 706-73 CPP'], niveau: 2, duree: 120 },

  { id: 'oral_m08_01', theme: 'GAV', q: 'Peut-on placer à nouveau une personne en garde à vue pour les mêmes faits / la même enquête ?', points: ['Principe : une seule garde à vue continue pour une même enquête ; prolongations selon art. 63-3 et régimes spéciaux (706-88, terrorisme)', 'Notification d\'un **nouveau chef** d\'infraction en cours de GAV ne crée pas une nouvelle garde à vue distincte (jurisprudence sur l\'art. 65 CPP)', 'Nouvelle GAV possible si **enquête distincte** ou conditions matérielles nouvelles et autonomes — toujours sous le cumul de l\'art. 62-2 CPP', 'Chaque placement : notification des droits, avis au procureur, durées plafonnées'], articles: ['Art. 62-2 CPP', 'Art. 63 CPP', 'Art. 65 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m08_02', theme: 'GAV', q: 'Quels contrôles externes s\'exercent sur les conditions de garde à vue ?', points: ['Procureur de la République : information et contrôle des placements, prolongations, suites à donner (art. 63 et s. CPP)', 'Contrôleur général des lieux de privation de liberté (CGLPL) : visites et recommandations — loi organique n° 2007-1545 du 29 octobre 2007', 'Parlementaires : députés, sénateurs (et selon le texte MEP) — droit de visite des locaux de GAV (art. 719 CPP)', 'Comité européen pour la prévention de la torture (CPT) : visites en application de la Convention européenne du 26 novembre 1987', 'Juge des libertés : prolongations au-delà de certains seuils (706-88, etc.)'], articles: ['Art. 63 CPP', 'Art. 719 CPP', 'Loi n° 2007-1545 du 29 octobre 2007'], niveau: 2, duree: 120 },
  { id: 'oral_m08_03', theme: 'GAV', q: 'Qui peut autoriser le report de la présence de l\'avocat lors d\'auditions en garde à vue et pour combien de temps ?', points: ['Décision **écrite et motivée** par le procureur de la République ou le juge d\'instruction selon les cas (art. 63-4-3 CPP)', 'Report maximal de **douze heures** par le procureur ou le juge d\'instruction pour raisons impérieuses tenant aux circonstances de l\'enquête', 'Au-delà de douze heures jusqu\'à **vingt-quatre heures** : compétence du **juge des libertés et de la détention** pour crimes ou délits punis d\'au moins cinq ans d\'emprisonnement (art. 63-4-3 CPP)', 'Le report doit être circonstancié — contrôle de proportionnalité'], articles: ['Art. 63-4-3 CPP'], niveau: 2, duree: 120 },

  { id: 'oral_m11_01', theme: 'PERQUIZ', q: 'Quels lieux ou personnalités bénéficient d\'une protection renforcée lors des perquisitions (hors cadre ordinaire) ?', points: ['Locaux diplomatiques et consulaires : inviolabilité des locaux mission diplomatique (Conventions de Vienne sur les relations diplomatiques et consulaires — ne pas perquisitionner sans cadre international)', 'Assemblée nationale / Sénat : perquisitions au Palais-Bourbon ou au Luxembourg sous conditions du droit des assemblées (lois organiques — autorisation souvent requise)', 'Établissements d\'enseignement : coordination avec l\'autorité administrative compétente selon les textes spéciaux', 'À distinguer des règles procédurales ordinaires art. 56 à 59 CPP'], articles: ['Art. 56 CPP', 'Art. 59 CPP', 'Convention de Vienne sur les relations diplomatiques du 18 avril 1961'], niveau: 2, duree: 120 },
  { id: 'oral_m11_02', theme: 'PERQUIZ', q: 'Quelles sont les règles spéciales de perquisition chez l\'avocat, la presse et le médecin ?', points: ['Avocat : art. 56-1 CPP — présence d\'un magistrat et du représentant de l\'ordre des avocats ; secret professionnel ; procédure 56-1-1 si documents défense', 'Presse : art. 56-2 CPP — magistrat habilité, représentant de la profession, limites liées à la liberté d\'information', 'Médecin ou professionnel de santé : art. 56-3 CPP — magistrat + représentant de l\'ordre ou de la caisse / autorité compétente selon le cas', 'Objectif : concilier enquête et droits fondamentaux'], articles: ['Art. 56-1 CPP', 'Art. 56-2 CPP', 'Art. 56-3 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m11_03', theme: 'PERQUIZ', q: 'La fouille d\'un véhicule sur la voie publique est-elle soumise aux « heures légales » des perquisitions domiciliaires (6h–21h) ?', points: ['Non pour le véhicule **sur la voie publique** et n\'ayant pas le caractère de domicile : contrôles et fouilles encadrés notamment par les art. 78-2 et suivants CPP (contrôle d\'identité, visites)', 'Les **heures légales** de l\'art. 59 CPP visent surtout les perquisitions **domiciliaires** et assimilées', 'Fouille sur réquisition du procureur dans les hypothèses limitatives (art. 78-2-2 CPP : stupéfiants, armes, terrorisme, etc.) avec durée plafonnée', 'Dès lors que le véhicule constitue un **domicile** (aménagé pour y vivre), le régime domiciliaire s\'applique'], articles: ['Art. 59 CPP', 'Art. 78-2 CPP', 'Art. 78-2-2 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m11_04', theme: 'PERQUIZ', q: 'Lors d\'une perquisition, que faire en cas de découverte d\'objets non visés par le titre exécutoire ?', points: ['Principe de **spécialité** de la perquisition : on ne saisit que ce qui concerne l\'infraction visée et les infractions connexes selon la loi', 'Découverte fortuite d\'éléments révélant une autre infraction : mentions précises au procès-verbal ; saisie éventuelle si texte l\'autorise (art. 56 et s. CPP, jurisprudence)', 'Documents relevant du secret défense ou de la défense (56-1-1) : procédure renforcée', 'Ne pas étendre arbitrairement le périmètre sans nouveau titre ou cadre légal'], articles: ['Art. 56 CPP', 'Art. 56-1-1 CPP'], niveau: 2, duree: 120 },

  { id: 'oral_m12_01', theme: 'REQS', q: 'Quels sont les principaux fichiers ou traitements souvent visés par les réquisitions (FPR, TAJ, FNAEG, etc.) ?', points: ['**FPR** : fichier des personnes recherchées (réquisitions pour inscription, mise à jour, consultation selon habilitation — code de la sécurité intérieure / décrets)', '**TAJ** : traitement d\'antécédents judiciaires (bulletin n° 1, 2, 3 selon les cas)', '**FNAEG** : fichier national des empreintes génétiques (conditions d\'accès et d\'inscription strictes)', '**FIJAISV** : fichier automatisé des auteurs d\'infractions sexuelles violentes ; **SALVAC** : schémas corporels ; **FAED** : empreintes digitales ; autres traitements listés au CSI', 'Toujours distinguer réquisition **art. 60 CPP** (flagrance, initiative OPJ) et **art. 77-1 / 77-1-1 CPP** (préliminaire, autorisation du procureur)'], articles: ['Art. 60 CPP', 'Art. 77-1 CPP', 'Art. 77-1-1 CPP', 'Code de la sécurité intérieure'], niveau: 2, duree: 120 },

  { id: 'oral_m13_01', theme: 'TSE', q: 'Quelles durées maximales pour la géolocalisation selon les art. 230-32 à 230-33 CPP ?', points: ['Autorisation du procureur : **huit jours** lorsque l\'infraction n\'entre pas dans le champ particulier du crime / délinquance organisée (230-33 CPP)', 'Autorisation du procureur : **quinze jours** pour les crimes, délits punis d\'au moins trois ans **ou** infractions des art. 706-73 ou 706-73-1 CPP (criminalité organisée)', 'Prolongation par le **juge des libertés et de la détention** : **un mois** renouvelable dans les mêmes formes (plafond global d\'un an, deux ans pour 706-73 / 706-73-1)', 'Décisions écrites et motivées par les circonstances de fait'], articles: ['Art. 230-32 CPP', 'Art. 230-33 CPP'], niveau: 2, duree: 120 },

  { id: 'oral_m14_01', theme: 'LIBERTES', q: 'Quel est le cadre des contrôles d\'identité aux articles 78-1 à 78-6 CPP ?', points: ['78-1 : contrôle sur réquisition écrite du procureur (liste de personnes ou périmètre) pour infractions graves', '78-2 : contrôle sur initiative OPJ si une infraction vient d\'être commise / risque de destruction de preuves / recherche auteur flagrance', '78-3 à 78-6 : fouilles de véhicules, sacs, palpations de sécurité, périmètres de protection, modalités et proportionnalité', 'Toujours : identification de l\'agent, respect de la dignité et de la non-discrimination'], articles: ['Art. 78-1 CPP', 'Art. 78-2 CPP', 'Art. 78-3 CPP', 'Art. 78-4 CPP', 'Art. 78-5 CPP', 'Art. 78-6 CPP'], niveau: 2, duree: 120 },
  { id: 'oral_m14_02', theme: 'INTERNATIONAL', q: 'Étrangers en zone d\'attente et en rétention : quels ordres de grandeur de durée (majeurs) ?', points: ['**Zone d\'attente** (refus d\'entrée, aéroport, etc.) : maintien initial encadré puis prolongations par le juge des libertés — blocs de **jusqu\'à huit jours** possibles selon les prolongations (L. 221-3 à L. 221-5 CESEDA)', 'Durées et contrôle judiciaire stricts ; information écrite de la personne', '**Rétention administrative** d\'éloignement : durées plafonnées avec **contrôle du juge des libertés** (L. 551-1 et s. CESEDA) — schéma distinct de la GAV pénale', 'Le régime du **maintien à disposition de la justice** pour majeur après certaines décisions est prévu au livre VII CESEDA (ex. L. 743-19 — se tenir au jour du texte en vigueur pour les durées exactes)', 'Les **mineurs** ne sont pas soumis aux mêmes régimes de rétention administrative'], articles: ['L. 221-3 CESEDA', 'L. 221-4 CESEDA', 'L. 551-1 CESEDA', 'L. 743-19 CESEDA'], niveau: 2, duree: 120 },
  { id: 'oral_m14_03', theme: 'RESPONSABILITE', q: 'Quelles sont les catégories d\'armes au sens du code de la sécurité intérieure ?', points: ['**Catégorie A** : armes de guerre, munitions et certaines armes prohibées', '**Catégorie B** : armes soumises à autorisation (détention, port, achat)', '**Catégorie C** : armes soumises à déclaration', '**Catégorie D** : armes accessibles selon conditions (vente libre sous conditions d\'âge pour certaines)', 'Référence aux textes réglementaires pour le détail des listes (décrets d\'application)'], articles: ['Art. L. 311-1 CSI', 'Art. L. 311-2 CSI'], niveau: 2, duree: 120 },
  { id: 'oral_m14_04', theme: 'LIBERTES', q: 'Quelles bases légales pour l\'état d\'urgence et les dispositifs type Vigipirate (notions) ?', points: ['**État d\'urgence** : loi n° 55-385 du 3 avril 1955 (cadre, contrôle du Parlement et du Conseil constitutionnel selon les périodes)', '**État de siège** : art. 36 Constitution (cas exceptionnels, autorité militaire)', '**Vigipirate** : plan interministériel de vigilance, de prévention et de protection piloté au niveau gouvernemental (niveaux vigilance / sécurité renforcée / urgence attentat) — mise en œuvre opérationnelle par préfets et services ; pas un article isolé du CPP à citer à l\'oral', 'L\'OPJ applique le droit pénal de procédure habituel (contrôles art. 78-1 et s., réquisitions, etc.) sans confondre mesure de sûreté administrative et preuve pénale'], articles: ['Loi n° 55-385 du 3 avril 1955', 'Art. 36 Constitution'], niveau: 2, duree: 120 }
];
if(typeof window!=='undefined')window.ORAL_QB=ORAL_QB;

const ORAL_ARTICLE_INDEX=(function buildOralArticleIndex(){
  const idx={};
  ORAL_QB.forEach(q=>{
    (q.articles||[]).forEach(a=>{
      const k=String(a).replace(/\s/g,'').toLowerCase();
      if(!idx[k])idx[k]=[];
      if(!idx[k].includes(q.id))idx[k].push(q.id);
    });
  });
  return idx;
})();

/* ─── STATE ─── */
function defaultState(){
  return{
    v:STATE_VERSION,page:'onboarding',
    user:{name:'OPJ',xp:0,streak:0,lastActivity:null,sessionsDone:0,isPRO:false,examDate:'2026-06-15',streakRecord:0},
    qcm:{cards:{},queue:[],idx:0,answered:null,stats:{ok:0,ko:0,xp:0},done:false,ci:false},
    rev:{tab:'reviser'},lessons:{},fiches:{},
    settings:{haptics:true},
    badges:{},defi:{lastDate:'',done:false},
    shield:{count:1,lastEarned:null},
    activity:{},blitzBest:0,crDone:0,tq:0,dq:0,tcDone:0,dcDone:0,cv:0,
    perfectSessions:0,classifDone:0,lastBgAt:null,
    lightMode:false,annalesDone:{},pfs:{},fs:{},flashFsrs:{},fsDueSession:null,badgeUiSeen:{},_badgeUiBackfill:false,
    printed:{},printDone:0,isPro:false,
    oral:{done:{},scores:{}},
    examHistory:[],
    earlyBirdCount:0,
    pvDone:0,
    milestones:{},
    placementDone:false,placementScore:{},
    errorLog:{},
    // Missions quotidiennes v2 — objet rempli par ensureDailyMissions2 (date, active, prog)
    missions2:{},
    proExpiry:null,
    stripeCustId:null
  };
}
let S=defaultState();

function loadState(){
  let loaded=false;
  try{
    const r=localStorage.getItem(STORAGE_KEY);
    if(r){
      const s=JSON.parse(r);
      if(!s.v||s.v<STATE_VERSION){
        const prev=s;S=defaultState();
        if(prev.user)S.user={...S.user,...prev.user};
        if(prev.lessons)S.lessons=prev.lessons;
        if(prev.qcm?.cards)S.qcm.cards=prev.qcm.cards;
        if(prev.fiches)S.fiches=prev.fiches;
        if(prev.fs)S.fs=prev.fs;
        if(prev.flashFsrs)S.flashFsrs=prev.flashFsrs;
        if(prev.fsDueSession)S.fsDueSession=prev.fsDueSession;
        if(prev.pfs)S.pfs=prev.pfs;
        if(prev.printed)S.printed=prev.printed;
        if(prev.printDone)S.printDone=prev.printDone;
        if(prev.annalesDone)S.annalesDone=prev.annalesDone;
        if(prev.oral)S.oral={...S.oral,...prev.oral};
        if(prev.milestones)S.milestones=prev.milestones;
        if(prev.errorLog)S.errorLog=prev.errorLog;
        if(prev.placementDone)S.placementDone=prev.placementDone;
        if(prev.placementScore)S.placementScore=prev.placementScore;
        if(prev.badges)S.badges=prev.badges;
        if(prev.activity)S.activity=prev.activity;
        if(prev.missions2)S.missions2=prev.missions2;
        if(prev.examHistory)S.examHistory=prev.examHistory;
        else S.examHistory=[];
        if(prev.earlyBirdCount!==undefined)S.earlyBirdCount=prev.earlyBirdCount;
        if(prev.pvDone!==undefined)S.pvDone=prev.pvDone;
        S.isPro=prev.isPro||prev.user?.isPRO||false;
        if(!S.missions2)S.missions2={};
        if(S.proExpiry===undefined)S.proExpiry=prev.proExpiry??null;
        if(S.stripeCustId===undefined)S.stripeCustId=prev.stripeCustId??null;
        S.page='home';save();loaded=true;
      } else {
        S={...defaultState(),...s,page:'home'};
        if(!S.badges)S.badges={};if(!S.badgeUiSeen)S.badgeUiSeen={};
        if(!S._badgeUiBackfill){S._badgeUiBackfill=true;Object.keys(S.badges||{}).forEach(id=>{S.badgeUiSeen[id]=1;});try{save();}catch(e){}}
        if(!S.shield)S.shield={count:1,lastEarned:null};
        if(!S.activity)S.activity={};if(!S.defi)S.defi={lastDate:'',done:false};
        if(!S.pfs)S.pfs={};if(!S.fs)S.fs={};if(!S.flashFsrs)S.flashFsrs={};if(S.fsDueSession===undefined)S.fsDueSession=null;if(!S.annalesDone)S.annalesDone={};
        if(!S.printed)S.printed={};if(!S.printDone)S.printDone=0;
        if(S.isPro===undefined)S.isPro=S.user?.isPRO||false;
        if(!S.oral)S.oral={done:{},scores:{}};
        if(!S.milestones)S.milestones={};
        if(!S.placementDone)S.placementDone=false;
        if(!S.placementScore)S.placementScore={};
        if(!S.errorLog)S.errorLog={};
        if(!S.examHistory)S.examHistory=[];
        if(S.earlyBirdCount===undefined)S.earlyBirdCount=0;
        if(S.pvDone===undefined)S.pvDone=0;
        if(!S.missions2)S.missions2={};
        if(S.proExpiry===undefined)S.proExpiry=null;
        if(S.stripeCustId===undefined)S.stripeCustId=null;
        loaded=true;
      }
    }
  }catch(e){console.warn('[OPJ] loadState error:',e);}
  if(!loaded){
    const old=localStorage.getItem('opje_v59')||localStorage.getItem('opje_v58')||localStorage.getItem('opje_v57')||localStorage.getItem('opje_v51')||localStorage.getItem('opje_v30')||localStorage.getItem('opj_v30')||localStorage.getItem('opje_v29')||localStorage.getItem('opj_v29');
    if(old){
      try{
        const d=JSON.parse(old);
        S=defaultState();
        if(d.user)S.user={...S.user,...d.user};
        if(d.lessons)S.lessons=d.lessons;
        if(d.qcm?.cards)S.qcm.cards=d.qcm.cards;
        if(d.fiches)S.fiches=d.fiches;
        if(d.fs)S.fs=d.fs;
        if(d.flashFsrs)S.flashFsrs=d.flashFsrs;
        if(d.fsDueSession)S.fsDueSession=d.fsDueSession;
        if(d.pfs)S.pfs=d.pfs;
        if(d.printed)S.printed=d.printed;
        if(d.printDone)S.printDone=d.printDone;
        if(d.annalesDone)S.annalesDone=d.annalesDone;
        if(d.oral)S.oral={...S.oral,...d.oral};
        if(d.milestones)S.milestones=d.milestones;
        if(d.errorLog)S.errorLog=d.errorLog;
        if(d.placementDone)S.placementDone=d.placementDone;
        if(d.placementScore)S.placementScore=d.placementScore;
        if(d.badges)S.badges=d.badges;
        if(d.activity)S.activity=d.activity;
        if(d.missions2)S.missions2=d.missions2;
        if(d.examHistory)S.examHistory=d.examHistory;
        else S.examHistory=[];
        if(d.earlyBirdCount!==undefined)S.earlyBirdCount=d.earlyBirdCount;
        if(d.pvDone!==undefined)S.pvDone=d.pvDone;
        if(!S.missions2)S.missions2={};
        if(S.proExpiry===undefined)S.proExpiry=d.proExpiry??null;
        if(S.stripeCustId===undefined)S.stripeCustId=d.stripeCustId??null;
        S.isPro=d.isPro||d.user?.isPRO||false;
        S.page='home';
        save();
      }catch(e){console.warn('[OPJ] migration error:',e);}
    }
  }
}
let _saveQueued=false,_lastSave=0;
function save(){
  if(S.user.isPRO&&!S.isPro)S.isPro=true;
  if(S.isPro&&!S.user.isPRO)S.user.isPRO=true;
  const now=Date.now();
  if(now-_lastSave>300){
    _lastSave=now;
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(S));
      localStorage.setItem('opje_sync_ts',String(Date.now()));
    }catch(e){showToast('⚠️ Stockage plein','err');}
    if(typeof currentUser!=='undefined'&&currentUser&&SYNC.debouncedSave)SYNC.debouncedSave();
  }else if(!_saveQueued){
    _saveQueued=true;
    setTimeout(()=>{
      _saveQueued=false;_lastSave=Date.now();
      try{
        localStorage.setItem(STORAGE_KEY,JSON.stringify(S));
        localStorage.setItem('opje_sync_ts',String(Date.now()));
      }catch(e){}
      if(typeof currentUser!=='undefined'&&currentUser&&SYNC.debouncedSave)SYNC.debouncedSave();
    },300);
  }
}

/* ─── FSRS : défini dans js/core/fsrs.js (const FSRS — ne pas redéclarer ici). ─── */

/* ─── GRADES HELPERS ─── */
function getGrade(){let g=GRADES[0];for(const gr of GRADES)if(S.user.xp>=gr.min)g=gr;return g;}
function getNextGrade(){for(const gr of GRADES)if(S.user.xp<gr.min)return gr;return null;}
function getXPPct(){const g=getGrade(),n=getNextGrade();if(!n)return 100;return Math.min(100,Math.round((S.user.xp-g.min)/(n.min-g.min)*100));}

let _levelUpTimer=null;
function showLevelUpOverlay(newGrade){
  try{AudioFX.levelUp();}catch(e){}
  const ov=document.getElementById('levelup-ov');
  if(!ov)return;
  const n=getNextGrade();
  const pct=getXPPct();
  const iconEl=document.getElementById('lu-icon');
  const nameEl=document.getElementById('lu-name');
  const metaEl=document.getElementById('lu-xp-meta');
  const fill=document.getElementById('lu-xp-fill');
  if(iconEl)iconEl.innerHTML=gradeSvg(newGrade);
  if(nameEl)nameEl.textContent=newGrade.name;
  if(metaEl)metaEl.textContent=n?`${S.user.xp} / ${n.min} XP`:`${S.user.xp} XP · max`;
  if(fill){
    fill.style.transition='none';
    fill.style.width='0%';
  }
  ov.style.display='flex';
  ov.removeAttribute('inert');
  document.body.style.overflow='hidden';
  haptic(200);
  if(typeof confetti==='function')confetti(true);
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      if(fill){
        fill.style.transition='width 1.1s cubic-bezier(.34,1.2,.64,1)';
        fill.style.width=pct+'%';
      }
    });
  });
  const av=document.getElementById('pr-av');
  if(av){av.classList.add('level-up-anim');setTimeout(()=>av.classList.remove('level-up-anim'),700);}
  clearTimeout(_levelUpTimer);
  _levelUpTimer=setTimeout(()=>closeLevelUp(),3000);
}
function closeLevelUp(){
  const ov=document.getElementById('levelup-ov');
  if(ov){ov.style.display='none';ov.setAttribute('inert','');}
  document.body.style.overflow='';
  clearTimeout(_levelUpTimer);
  _levelUpTimer=null;
}

/* ─── THEME ─── */
const THEME28={
  apply(){
    const m=S.lightMode;
    document.documentElement.setAttribute('data-theme',m?'light':'dark');
    const lbl=document.getElementById('theme-label');
    if(lbl)lbl.textContent=m?'Mode sombre':'Mode clair';
  },
  toggle(){S.lightMode=!S.lightMode;save();THEME28.apply();}
};

/* ─── XP & STREAK ─── */
function getStreakMultiplier(){
  const streak=S.user?.streak||0;
  return Math.min(2,1+Math.floor(streak/7)*0.1);
}
function addXP(base){
  const mult=getStreakMultiplier();
  const amount=Math.round(base*mult);
  const multStr=mult>1?(' ×'+mult.toFixed(1)):'';
  const before=getGrade();
  S.user.xp+=amount;
  /* ── Milestones XP ── */
  const MILESTONES=[100,500,1000,2000,5000,10000];
  if(!S.milestones)S.milestones={};
  for(const ms of MILESTONES){
    if(!S.milestones[ms]&&S.user.xp>=ms){
      S.milestones[ms]=Date.now();
      setTimeout(()=>{
        try{if(typeof confetti==='function')confetti(true);}catch(e){}
        try{
          const ctx=new(window.AudioContext||window.webkitAudioContext)();
          [[523,.05],[659,.15],[784,.25],[1047,.4]].forEach(([freq,t])=>{
            const o=ctx.createOscillator(),g=ctx.createGain();
            o.connect(g);g.connect(ctx.destination);
            o.frequency.value=freq;
            g.gain.setValueAtTime(.25,ctx.currentTime+t);
            g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+t+.4);
            o.start(ctx.currentTime+t);
            o.stop(ctx.currentTime+t+.5);
          });
        }catch(e){}
        showToast('🏆 MILESTONE — '+ms.toLocaleString('fr-FR')+' XP débloqués !'+multStr,'ok');
      },400);
      break;
    }
  }
  const after=getGrade();
  if(after.min>before.min){
    setTimeout(()=>showLevelUpOverlay(after),300);
  }
  updateStreak();
  // Track activity
  const today=new Date().toDateString();
  if(!S.activity)S.activity={};
  S.activity[today]=true;
  const keys=Object.keys(S.activity);
  if(keys.length>60){delete S.activity[keys.sort()[0]];}
  save();
  BADGES.checkAll();
  try{syncPageHeader(S.page||'home');}catch(e){}
  try{if(typeof NOTIF!=='undefined'&&NOTIF.onActivityMaybe)NOTIF.onActivityMaybe();}catch(_){}
}
// CHOIX DÉLIBÉRÉ : streak par jour calendaire (J vs J-1)
// et non par fenêtre glissante de 24h.
// Avantage : intuitif ("j'ai révisé aujourd'hui").
// Inconvénient : révision à 23h59 puis 00h01 = 2 jours.
// À ne pas modifier sans mettre à jour la migration state.
function updateStreak(){
  const today=new Date().toDateString();
  const yest=new Date(Date.now()-86400000).toDateString();
  if(S.user.lastActivity===today)return;
  S.user.streak=S.user.lastActivity===yest?(S.user.streak||0)+1:1;
  S.user.lastActivity=today;
  if(S.user.streak>(S.user.streakRecord||0))S.user.streakRecord=S.user.streak;
}

/* ─── Notifications locales (streak) — pas de serveur push requis pour showLocal ─── */
const NOTIF_LS_NEXT='opj_notif_next_at';
const NOTIF_LS_BANNER='opj_notif_banner_dismiss_until';
const NOTIF={
  _t:null,
  _assetUrl(rel){
    try{return new URL(rel.replace(/^\//,''),new URL('./',window.location.href)).href;}
    catch(_){return rel;}
  },
  async requestPermission(){
    if(!('Notification' in window))return false;
    const perm=await Notification.requestPermission();
    return perm==='granted';
  },
  showLocal(title,body){
    if(Notification.permission!=='granted')return;
    const icon=this._assetUrl('icons/icon-192.png');
    try{
      new Notification(title,{
        body,
        icon,
        badge:icon,
        tag:'streak-reminder',
        renotify:true
      });
    }catch(_){}
  },
  _clearTimer(){
    if(this._t){clearTimeout(this._t);this._t=null;}
  },
  onActivityMaybe(){
    const today=new Date().toDateString();
    if(S.activity?.[today]){
      this._clearTimer();
      try{localStorage.removeItem(NOTIF_LS_NEXT);}catch(_){}
    }
  },
  schedule(){
    this._clearTimer();
    const today=new Date().toDateString();
    const isActive=S.activity?.[today];
    if(!(S.user.streak>0&&!isActive)){
      try{localStorage.removeItem(NOTIF_LS_NEXT);}catch(_){}
      return;
    }
    if(Notification.permission!=='granted')return;
    const delayMs=2*60*60*1000;
    const nextAt=Date.now()+delayMs;
    try{localStorage.setItem(NOTIF_LS_NEXT,String(nextAt));}catch(_){}
    this._t=setTimeout(()=>{
      const t2=new Date().toDateString();
      if(S.activity?.[t2])return;
      this.showLocal(
        `🔥 Ton streak de ${S.user.streak} jours est en danger !`,
        'Reviens t\'entraîner avant minuit pour le conserver.'
      );
      try{localStorage.removeItem(NOTIF_LS_NEXT);}catch(_){}
    },delayMs);
    this._registerSync();
  },
  _restoreTimer(){
    if(Notification.permission!=='granted')return;
    let raw;
    try{raw=localStorage.getItem(NOTIF_LS_NEXT);}catch(_){return;}
    if(!raw)return;
    const nextAt=parseInt(raw,10);
    const left=nextAt-Date.now();
    if(left<=0){this.schedule();return;}
    this._clearTimer();
    this._t=setTimeout(()=>this.schedule(),Math.max(0,left));
  },
  async _registerSync(){
    try{
      const reg=await navigator.serviceWorker.ready;
      if(reg.sync&&typeof reg.sync.register==='function'){
        await reg.sync.register('streak-check');
      }
    }catch(_){}
  },
  async _registerSW(){
    if(!('serviceWorker' in navigator))return null;
    try{
      return await navigator.serviceWorker.register(new URL('sw.js',window.location.href),{scope:'./'});
    }catch(_){return null;}
  },
  async init(){
    await this._registerSW();
    this._restoreTimer();
    const hour=new Date().getHours();
    if(hour>=18)this.schedule();
    showNotifPermissionBanner();
  }
};
function notifBannerDismissedLong(){
  try{
    const until=parseInt(localStorage.getItem(NOTIF_LS_BANNER)||'0',10);
    return Date.now()<until;
  }catch(_){return false;}
}
function notifIosStandaloneOk(){
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!isIOS)return true;
  return navigator.standalone===true||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);
}
function showNotifPermissionBanner(){
  const wrap=document.getElementById('notif-perm-banner');
  if(!wrap)return;
  if(!('Notification' in window)){wrap.hidden=true;wrap.innerHTML='';return;}
  if(!notifIosStandaloneOk()){wrap.hidden=true;wrap.innerHTML='';return;}
  if(notifBannerDismissedLong()){wrap.hidden=true;wrap.innerHTML='';return;}
  if((S.user.streak||0)<3||Notification.permission!=='default'){wrap.hidden=true;wrap.innerHTML='';return;}
  wrap.hidden=false;
  wrap.innerHTML=`<div class="notif-perm-inner">
    <div class="notif-perm-txt">🔔 Active les rappels pour ne jamais perdre ton streak</div>
    <div class="notif-perm-actions">
      <button type="button" class="notif-perm-btn notif-perm-btn--main" id="notif-perm-ok">Activer</button>
      <button type="button" class="notif-perm-btn notif-perm-btn--ghost" id="notif-perm-later">Plus tard</button>
    </div>
  </div>`;
  const ok=document.getElementById('notif-perm-ok');
  const later=document.getElementById('notif-perm-later');
  if(ok)ok.onclick=async()=>{
    const granted=await NOTIF.requestPermission();
    wrap.hidden=true;
    wrap.innerHTML='';
    if(granted){
      NOTIF.schedule();
      if(typeof showToast==='function')showToast('Rappels activés','ok');
    }
  };
  if(later)later.onclick=()=>{
    try{localStorage.setItem(NOTIF_LS_BANNER,String(Date.now()+7*86400000));}catch(_){}
    wrap.hidden=true;
    wrap.innerHTML='';
  };
}

/* ─── NAVIGATION ─── */
function syncPageHeader(page){
  const g=typeof getGrade==='function'?getGrade():{name:'',icon:'👮'};
  const xpStr=(S.user?.xp??0)+' XP';
  const map={
    home:['hdr-xp','hdr-grade-pill'],
    lecons:['hdr-xp-lec','hdr-grade-pill-lec'],
    revision:['hdr-xp-rev','hdr-grade-pill-rev'],
    examen:['hdr-xp-exam','hdr-grade-pill-exam'],
    profil:['hdr-xp-profil','hdr-grade-pill-profil']
  };
  const ids=map[page]||map.home;
  const xEl=document.getElementById(ids[0]);
  const gEl=document.getElementById(ids[1]);
  if(xEl)xEl.textContent=xpStr;
  if(gEl)gEl.textContent=g.name||'';
}
/** Skeleton loaders (liste) — shimmer CSS dans index.html */
function renderSkeletons(containerId,count,heightPx,opts){
  opts=opts||{};
  const el=document.getElementById(containerId);
  if(!el)return;
  if(opts.tile){
    const w=opts.width||80;
    el.innerHTML='<div class="skeleton-ft-wrap">'+Array.from({length:count},()=>'<div class="skeleton" style="width:'+w+'px;height:'+heightPx+'px;border-radius:12px;flex-shrink:0"></div>').join('')+'</div>';
    return;
  }
  el.innerHTML='<div class="skeleton-stack" style="display:flex;flex-direction:column;gap:8px">'+Array.from({length:count},()=>'<div class="skeleton" style="height:'+heightPx+'px;border-radius:12px"></div>').join('')+'</div>';
}
function runPageRender(page){
  if(page==='home')renderHome();
  else if(page==='lecons')renderLecons();
  else if(page==='revision')renderRevision();
  else if(page==='profil')renderProfil();
}
function navigateTo(page){
  const prevPageEl=document.querySelector('.page.active');
  if(prevPageEl&&prevPageEl.id==='p-examen-blanc'){
    stopExamBlancTimer();
    examBlancSession=null;
  }
  if(prevPageEl&&prevPageEl.id==='p-jour-j')jourJSession=null;
  const newEl=document.getElementById('p-'+page);
  if(!newEl)return;
  const oldEl=document.querySelector('.page.active');
  S.page=page;
  if(oldEl===newEl){
    runPageRender(page);
    syncPageHeader(page);
    window.scrollTo({top:0,behavior:'instant'});
    return;
  }
  const finish=()=>{
    document.querySelectorAll('.page').forEach(p=>{
      p.classList.remove('active','leaving','entering');
      p.style.display='';
    });
    newEl.classList.add('active','entering');
    void newEl.offsetWidth;
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{newEl.classList.remove('entering');});
    });
    document.querySelectorAll('.nav-btn').forEach(b=>{b.classList.toggle('active',b.id==='nav-'+page);});
    runPageRender(page);
    syncPageHeader(page);
    window.scrollTo({top:0,behavior:'instant'});
  };
  if(oldEl){
    oldEl.classList.add('leaving');
    setTimeout(finish,80);
  }else{
    finish();
  }
}
/* goLesson/goRevision supprimés — inutilisés */

/** Prochaine leçon non vue (parcours CHAPTERS dans l'ordre). */
function getNextUnseenLessonId(){
  if(typeof CHAPTERS==='undefined'||!CHAPTERS)return null;
  for(const ch of CHAPTERS){
    for(const l of ch.lessons||[]){
      if(!S.lessons[l.id])return l.id;
    }
  }
  return null;
}

function getOralThemePerfRows(){
  if(typeof ORAL_QB==='undefined'||!ORAL_QB.length||typeof ORAL_THEME_META==='undefined')return[];
  S.oral=S.oral||{done:{},scores:{}};
  const rows=[];
  for(const meta of ORAL_THEME_META){
    const list=ORAL_QB.filter(q=>q.theme===meta.key);
    if(!list.length)continue;
    const missing=list.filter(q=>!S.oral.done[q.id]).length;
    let n=0,sum=0;
    list.forEach(q=>{
      const sc=S.oral.scores[q.id];
      if(sc!==undefined){sum+=sc;n++;}
    });
    const avg=n?sum/n:0;
    const weakness=missing*6+(list.length-missing)*(3-avg);
    let masterySum=0;
    list.forEach(q=>{
      const maxP=q.points?.length||1;
      if(S.oral.done[q.id])masterySum+=Math.min(1,(S.oral.scores[q.id]||0)/maxP);
    });
    const score=masterySum/list.length;
    rows.push({key:meta.key,name:meta.label,score,weakness});
  }
  return rows;
}
function getWeakestOralTheme(){
  const rows=getOralThemePerfRows();
  let bestKey=null,bestW=-1;
  rows.forEach(t=>{if(t.weakness>bestW){bestW=t.weakness;bestKey=t.key;}});
  if(bestW<=0)return null;
  return bestKey;
}
function normalizeArticleInput(s){
  return String(s)
    .toLowerCase()
    .replace(/article\.?\s*/gi,'')
    .replace(/art\.?\s*/gi,'')
    .replace(/^l\.?/i,'')
    .replace(/\s+/g,'')
    .replace(/\./g,'-');
}
function searchOralByArticleSnippet(snippet){
  if(!snippet||snippet.length<2||typeof ORAL_QB==='undefined')return[];
  const k=normalizeArticleInput(snippet);
  if(!k)return[];
  const idSet=new Set();
  Object.entries(ORAL_ARTICLE_INDEX).forEach(([art,ids])=>{
    if(art.includes(k))ids.forEach(id=>idSet.add(id));
  });
  return Array.from(idSet).map(id=>ORAL_QB.find(q=>q.id===id)).filter(Boolean);
}
function renderModuleLacunesOralHtml(){
  const rows=getOralThemePerfRows();
  if(!rows.length)return '';
  const sorted=[...rows].sort((a,b)=>a.score-b.score);
  return sorted.map(t=>{
    const pct=Math.round(t.score*100);
    const col=t.score<0.5?'var(--err)':t.score<0.75?'var(--warn)':'var(--ok)';
    return`<div class="module-stat-row">
      <span class="module-stat-name">${eh(t.name)}</span>
      <div class="module-stat-bar"><div class="module-stat-fill" style="width:${pct}%;background:${col}"></div></div>
      <span class="module-stat-pct">${pct}%</span>
    </div>`;
  }).join('');
}

function buildExamBlancQuestions(){
  if(typeof ORAL_QB==='undefined'||!ORAL_QB.length)return[];
  const themes=[...new Set(ORAL_QB.map(q=>q.theme))];
  const questions=[];
  themes.forEach(theme=>{
    const pool=ORAL_QB.filter(q=>q.theme===theme);
    const shuffled=[...pool].sort(()=>Math.random()-0.5);
    questions.push(...shuffled.slice(0,2));
  });
  return questions.sort(()=>Math.random()-0.5);
}

function startExamBlancTimer(onTick,onExpire){
  let remaining=2700;
  onTick(remaining);
  examBlancTimerId=setInterval(()=>{
    remaining--;
    onTick(remaining);
    if(remaining<=0){
      clearInterval(examBlancTimerId);
      examBlancTimerId=null;
      onExpire();
    }
  },1000);
}
function stopExamBlancTimer(){
  if(examBlancTimerId){
    clearInterval(examBlancTimerId);
    examBlancTimerId=null;
  }
}
function formatTimerDisplay(seconds){
  const m=Math.floor(seconds/60).toString().padStart(2,'0');
  const s=(seconds%60).toString().padStart(2,'0');
  return m+':'+s;
}
function injectExamenBlancQuizShell(){
  const p=document.getElementById('p-examen-blanc');
  if(!p)return;
  p.innerHTML=`
  <div class="app-hdr eb-app-hdr">
    <button type="button" class="btn btn-ghost btn-sm eb-hdr-close" id="eb-close-btn" aria-label="Quitter l'examen blanc">✕</button>
    <h2 class="app-hdr__title">Examen blanc</h2>
    <span id="eb-timer" class="eb-timer">45:00</span>
  </div>
  <div class="scroll-area">
    <div class="content">
      <div class="eb-progress-bar">
        <div class="eb-progress-fill" id="eb-progress-fill"></div>
      </div>
      <p class="eb-counter" id="eb-counter">Question 1 / 28</p>
      <div class="eb-question-card" id="eb-question-card">
        <p class="eb-theme" id="eb-theme"></p>
        <p class="eb-question-text" id="eb-question-text"></p>
      </div>
      <div id="eb-answer-section" style="display:none">
        <div class="eb-answer-card" id="eb-answer-card"></div>
        <div class="eb-eval-btns">
          <button type="button" class="btn-sec eb-btn-wrong" id="eb-btn-wrong">✗ Incorrect</button>
          <button type="button" class="btn-primary eb-btn-correct" id="eb-btn-correct">✓ Correct</button>
        </div>
      </div>
      <div id="eb-reveal-section">
        <button type="button" class="btn-primary eb-btn-reveal" id="eb-btn-reveal">Voir la réponse</button>
      </div>
    </div>
  </div>`;
}
function renderExamenBlancQuestion(){
  if(!examBlancSession)return;
  const{questions,currentIndex}=examBlancSession;
  const q=questions[currentIndex];
  if(!q){finishExamenBlanc('done');return;}
  const total=questions.length;
  const ec=document.getElementById('eb-counter');
  if(ec)ec.textContent='Question '+(currentIndex+1)+' / '+total;
  const fill=document.getElementById('eb-progress-fill');
  if(fill)fill.style.width=(currentIndex/total*100)+'%';
  const th=document.getElementById('eb-theme');
  if(th)th.textContent=q.theme||'';
  const qt=document.getElementById('eb-question-text');
  if(qt)qt.textContent=q.q||'';
  const ansSec=document.getElementById('eb-answer-section');
  const revSec=document.getElementById('eb-reveal-section');
  if(ansSec)ansSec.style.display='none';
  if(revSec)revSec.style.display='block';
  examBlancSession.revealed=false;
  const answerCard=document.getElementById('eb-answer-card');
  if(answerCard){
    const pointsHtml=(q.points||[]).map(pt=>'<li class="eb-point">'+eh(pt)+'</li>').join('');
    const articlesHtml=(q.articles||[]).map(a=>'<span class="eb-article-tag">'+eh(a)+'</span>').join('');
    answerCard.innerHTML='<ul class="eb-points">'+pointsHtml+'</ul><div class="eb-articles">'+articlesHtml+'</div>';
  }
}
function recordExamenBlancAnswer(correct){
  if(!examBlancSession)return;
  const q=examBlancSession.questions[examBlancSession.currentIndex];
  const theme=q.theme||'Autre';
  if(!examBlancSession.scores[theme])examBlancSession.scores[theme]={bon:0,total:0};
  examBlancSession.scores[theme].total++;
  if(correct){
    examBlancSession.scores[theme].bon++;
    examBlancSession.bonnes++;
  }
  S.oral=S.oral||{done:{},scores:{}};
  const nPts=q.points?.length||1;
  S.oral.done[q.id]=true;
  const prev=S.oral.scores[q.id]||0;
  const ptsKnown=correct?nPts:0;
  S.oral.scores[q.id]=Math.max(prev,ptsKnown);
  examBlancSession.currentIndex++;
  if(examBlancSession.currentIndex>=examBlancSession.questions.length)finishExamenBlanc('done');
  else renderExamenBlancQuestion();
}
function finishExamenBlanc(reason){
  stopExamBlancTimer();
  if(!examBlancSession)return;
  const duree=Math.floor((Date.now()-examBlancSession.startTime)/1000);
  const total=examBlancSession.questions.length;
  const bonnes=examBlancSession.bonnes;
  const scoreGlobal=total>0?bonnes/total:0;
  const scoreParModule={...examBlancSession.scores};
  examBlancSession=null;
  const entry={
    date:new Date().toISOString(),
    scoreGlobal,
    scoreParModule,
    dureeSecondes:duree,
    nbQuestions:total,
    bonnes
  };
  S.examHistory=S.examHistory||[];
  S.examHistory.push(entry);
  while(S.examHistory.length>5)S.examHistory.shift();
  try{save();}catch(e){}
  renderExamenBlancResultats(entry,reason);
}
function renderExamenBlancResultats(entry,reason){
  const pct=Math.round(entry.scoreGlobal*100);
  const dureeMin=Math.floor(entry.dureeSecondes/60);
  const dureeS=entry.dureeSecondes%60;
  const timeoutMsg=reason==='timeout'?'<p class="eb-timeout-msg">⏱ Temps écoulé</p>':'';
  const modulesRows=Object.entries(entry.scoreParModule)
    .sort((a,b)=>{
      const ra=a[1].total?a[1].bon/a[1].total:0;
      const rb=b[1].total?b[1].bon/b[1].total:0;
      return ra-rb;
    })
    .map(([theme,sc])=>{
      const p=sc.total>0?Math.round(sc.bon/sc.total*100):0;
      const cls=p<50?'eb-score--err':p<75?'eb-score--warn':'eb-score--ok';
      return'<tr><td class="eb-td-theme">'+eh(theme)+'</td><td class="eb-td-score '+cls+'">'+p+'%</td><td class="eb-td-bar"><div class="eb-mini-bar"><div class="eb-mini-fill '+cls+'" style="width:'+p+'%"></div></div></td></tr>';
    }).join('');
  const scoreClass=pct>=75?'eb-global--ok':pct>=50?'eb-global--warn':'eb-global--err';
  const bonAff=entry.bonnes!=null?entry.bonnes:Math.round(entry.scoreGlobal*entry.nbQuestions);
  const root=document.getElementById('p-examen-blanc');
  if(!root)return;
  root.innerHTML=`
    <div class="app-hdr eb-app-hdr">
      <h2 class="app-hdr__title">Résultats</h2>
    </div>
    <div class="scroll-area">
      <div class="content">
        ${timeoutMsg}
        <div class="eb-score-global ${scoreClass}">${pct}%</div>
        <p class="eb-score-sub">
          ${bonAff} / ${entry.nbQuestions} correctes
          — ${dureeMin}min ${String(dureeS).padStart(2,'0')}s
        </p>
        <div class="table-scroll"><table class="eb-modules-table">
          <thead><tr>
            <th>Module</th><th>Score</th><th></th>
          </tr></thead>
          <tbody>${modulesRows}</tbody>
        </table></div>
        <div class="eb-result-btns">
          <button type="button" class="btn-sec" id="eb-btn-retry-errors">
            Revoir mes erreurs
          </button>
          <button type="button" class="btn-primary" id="eb-btn-close-result">
            Fermer
          </button>
        </div>
      </div>
    </div>`;
  document.getElementById('eb-btn-close-result')?.addEventListener('click',()=>{
    examBlancSession=null;
    navigateTo('home');
  });
  document.getElementById('eb-btn-retry-errors')?.addEventListener('click',()=>{
    examBlancSession=null;
    startSmartSession();
  });
}
function startExamenBlanc(){
  const questions=buildExamBlancQuestions();
  if(!questions.length){
    showToast('Aucune question disponible.','err');
    return;
  }
  injectExamenBlancQuizShell();
  examBlancSession={
    questions,
    currentIndex:0,
    scores:{},
    bonnes:0,
    startTime:Date.now(),
    revealed:false
  };
  showPage('p-examen-blanc');
  renderExamenBlancQuestion();
  startExamBlancTimer(remaining=>{
    const el=document.getElementById('eb-timer');
    if(el){
      el.textContent=formatTimerDisplay(remaining);
      el.classList.toggle('eb-timer--urgent',remaining<=60);
    }
  },()=>finishExamenBlanc('timeout'));
}
function showPage(pageId){
  const id=pageId.startsWith('p-')?pageId:'p-'+pageId;
  const prev=document.querySelector('.page.active');
  if(prev&&prev.id==='p-examen-blanc'&&id!=='p-examen-blanc'){
    stopExamBlancTimer();
    examBlancSession=null;
  }
  if(prev&&prev.id==='p-jour-j'&&id!=='p-jour-j')jourJSession=null;
  const newEl=document.getElementById(id);
  if(!newEl)return;
  document.querySelectorAll('.page').forEach(p=>{
    p.classList.remove('active','leaving','entering');
    p.style.display='';
  });
  newEl.classList.add('active','entering');
  void newEl.offsetWidth;
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{newEl.classList.remove('entering');});
  });
  const tab=id==='p-home'?'home':id==='p-lecons'?'lecons':id==='p-revision'?'revision':id==='p-examen'?'examen':id==='p-profil'?'profil':null;
  if(tab){
    S.page=tab;
    document.querySelectorAll('.nav-btn').forEach(b=>{b.classList.toggle('active',b.id==='nav-'+tab);});
    runPageRender(tab);
    syncPageHeader(tab);
  }else{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  }
  window.scrollTo({top:0,behavior:'instant'});
}
function initExamenBlancDelegation(){
  const root=document.getElementById('p-examen-blanc');
  if(!root||root._ebDel)return;
  root._ebDel=true;
  root.addEventListener('click',onExamenBlancRootClick);
}
function onExamenBlancRootClick(e){
  const btn=e.target.closest('button');
  const bid=btn?.id;
  if(bid==='eb-btn-reveal'){
    if(!examBlancSession||examBlancSession.revealed)return;
    examBlancSession.revealed=true;
    const ans=document.getElementById('eb-answer-section');
    const rev=document.getElementById('eb-reveal-section');
    if(ans)ans.style.display='block';
    if(rev)rev.style.display='none';
    return;
  }
  if(bid==='eb-btn-correct'){recordExamenBlancAnswer(true);return;}
  if(bid==='eb-btn-wrong'){recordExamenBlancAnswer(false);return;}
  if(bid==='eb-close-btn'){
    stopExamBlancTimer();
    examBlancSession=null;
    navigateTo('home');
  }
}
window.startExamenBlanc=startExamenBlanc;
window.showPage=showPage;

function getDueFlashcards(){
  if(typeof FSRS==='undefined'||!FSRS.getDueFlashcards)return[];
  return FSRS.getDueFlashcards(S.flashFsrs);
}
function jjFlashDueTs(f){
  const c=S.flashFsrs?.[f.id];
  const t=c?.due;
  return typeof t==='number'?t:Number(t)||0;
}
function buildRevisionJourJ(){
  let oralQuestions=[];
  let fichesDues=[];
  if(typeof getOralThemePerfRows==='function'&&typeof ORAL_QB!=='undefined'&&ORAL_QB.length){
    const rows=getOralThemePerfRows();
    const weakThemes=rows
      .sort((a,b)=>(a.score??0)-(b.score??0))
      .slice(0,5)
      .map(r=>r.key);
    if(weakThemes.length){
      oralQuestions=ORAL_QB.filter(q=>weakThemes.includes(q.theme))
        .sort(()=>Math.random()-0.5)
        .slice(0,10);
    }
  }
  const due=getDueFlashcards();
  if(due.length){
    fichesDues=[...due].sort((a,b)=>jjFlashDueTs(a)-jjFlashDueTs(b)).slice(0,5);
  }
  return{oralQuestions,fichesDues};
}
function reviewFlashcard(id,mastered){
  if(!id)return;
  if(S.fs)S.fs[id]=mastered?'m':'s';
  if(typeof FSRS!=='undefined'&&FSRS.reviewFlashcard)FSRS.reviewFlashcard(id,!!mastered);
  try{save();}catch(e){}
}
function renderJourJCurrent(){
  if(!jourJSession)return;
  const{phase,oralQuestions,oralIndex,fichesDues,ficheIndex}=jourJSession;
  const phaseEl=document.getElementById('jj-phase-label');
  if(phaseEl){
    if(phase==='oral'&&oralQuestions.length){
      phaseEl.textContent='Questions '+(oralIndex+1)+'/'+oralQuestions.length;
    }else if(phase==='fiches'&&fichesDues.length){
      phaseEl.textContent='Fiches '+(ficheIndex+1)+'/'+fichesDues.length;
    }else phaseEl.textContent='';
  }
  const content=document.getElementById('jj-content');
  if(!content)return;
  if(phase==='oral'){
    const q=oralQuestions[oralIndex];
    if(!q){
      jourJSession.phase=fichesDues.length?'fiches':'done';
      renderJourJCurrent();
      return;
    }
    const pointsHtml=(q.points||[]).map(p=>'<li class="jj-point">'+eh(p)+'</li>').join('');
    const articlesHtml=(q.articles||[]).map(a=>'<span class="jj-article-tag">'+eh(a)+'</span>').join('');
    content.innerHTML=
      '<div class="jj-card"><p class="jj-theme">'+eh(q.theme||'')+'</p><p class="jj-question">'+eh(q.q||'')+'</p></div>'+
      '<div id="jj-answer" style="display:none"><div class="jj-answer-card"><ul class="jj-points">'+pointsHtml+'</ul><div class="jj-articles">'+articlesHtml+'</div></div>'+
      '<div class="jj-eval-btns">'+
      '<button type="button" class="btn-sec" id="jj-wrong">✗ Incorrect</button>'+
      '<button type="button" class="btn-primary" id="jj-correct">✓ Correct</button></div></div>'+
      '<div id="jj-reveal"><button type="button" class="btn-sec jj-btn-reveal" id="jj-btn-reveal">Voir la réponse</button></div>';
  }else if(phase==='fiches'){
    const f=fichesDues[ficheIndex];
    if(!f){
      jourJSession.phase='done';
      renderJourJCurrent();
      return;
    }
    const recto=eh(f.nm||f.q||'');
    const verso=eh(f.L||f.A||'');
    content.innerHTML=
      '<div class="jj-card"><p class="jj-theme">Fiche '+eh(f.id||'')+'</p><p class="jj-question">'+recto+'</p></div>'+
      '<div id="jj-fiche-answer" style="display:none"><div class="jj-answer-card"><p class="jj-fiche-content">'+verso+'</p></div>'+
      '<div class="jj-eval-btns">'+
      '<button type="button" class="btn-sec" id="jj-fiche-again">À revoir</button>'+
      '<button type="button" class="btn-primary" id="jj-fiche-ok">Maîtrisé</button></div></div>'+
      '<div id="jj-fiche-reveal"><button type="button" class="btn-sec jj-btn-reveal" id="jj-fiche-btn-reveal">Voir la réponse</button></div>';
  }else{
    content.innerHTML=
      '<div class="jj-done"><p class="jj-done-icon">🎯</p><p class="jj-done-msg">Bonne chance pour ton examen</p>'+
      '<button type="button" class="btn-primary jj-btn-close-done" id="jj-btn-close-done">Fermer</button></div>';
  }
}
function jjAdvanceOral(correct){
  if(!jourJSession||jourJSession.phase!=='oral')return;
  const q=jourJSession.oralQuestions[jourJSession.oralIndex];
  if(q){
    S.oral=S.oral||{done:{},scores:{}};
    const nPts=q.points?.length||1;
    S.oral.done[q.id]=true;
    const prev=S.oral.scores[q.id]||0;
    const ptsKnown=correct?nPts:0;
    S.oral.scores[q.id]=Math.max(prev,ptsKnown);
    try{save();}catch(e){}
  }
  jourJSession.oralIndex++;
  if(jourJSession.oralIndex>=jourJSession.oralQuestions.length){
    jourJSession.phase=jourJSession.fichesDues.length?'fiches':'done';
  }
  renderJourJCurrent();
}
function onJourJRootClick(e){
  const btn=e.target.closest('button');
  const bid=btn?.id;
  if(bid==='jj-close-btn'){
    jourJSession=null;
    navigateTo('home');
    return;
  }
  if(!jourJSession)return;
  if(bid==='jj-btn-reveal'){
    const ans=document.getElementById('jj-answer');
    const rev=document.getElementById('jj-reveal');
    if(ans)ans.style.display='block';
    if(rev)rev.style.display='none';
    jourJSession.revealed=true;
    return;
  }
  if(bid==='jj-correct'){jjAdvanceOral(true);return;}
  if(bid==='jj-wrong'){jjAdvanceOral(false);return;}
  if(bid==='jj-fiche-btn-reveal'){
    const fa=document.getElementById('jj-fiche-answer');
    const fr=document.getElementById('jj-fiche-reveal');
    if(fa)fa.style.display='block';
    if(fr)fr.style.display='none';
    return;
  }
  if(bid==='jj-fiche-ok'){
    const f=jourJSession.fichesDues[jourJSession.ficheIndex];
    if(f)reviewFlashcard(f.id,true);
    jourJSession.ficheIndex++;
    if(jourJSession.ficheIndex>=jourJSession.fichesDues.length)jourJSession.phase='done';
    renderJourJCurrent();
    return;
  }
  if(bid==='jj-fiche-again'){
    const f=jourJSession.fichesDues[jourJSession.ficheIndex];
    if(f)reviewFlashcard(f.id,false);
    jourJSession.ficheIndex++;
    if(jourJSession.ficheIndex>=jourJSession.fichesDues.length)jourJSession.phase='done';
    renderJourJCurrent();
    return;
  }
  if(bid==='jj-btn-close-done'){
    jourJSession=null;
    navigateTo('home');
  }
}
function initJourJDelegation(){
  const root=document.getElementById('p-jour-j');
  if(!root||root._jjDel)return;
  root._jjDel=true;
  root.addEventListener('click',onJourJRootClick);
}
function startRevisionJourJ(){
  const{oralQuestions,fichesDues}=buildRevisionJourJ();
  if(!oralQuestions.length&&!fichesDues.length){
    showToast('Aucune question disponible pour la révision Jour J.','ok');
    return;
  }
  jourJSession={
    oralQuestions,
    fichesDues,
    phase:oralQuestions.length?'oral':'fiches',
    oralIndex:0,
    ficheIndex:0,
    revealed:false
  };
  showPage('p-jour-j');
  renderJourJCurrent();
}
window.reviewFlashcard=reviewFlashcard;

function renderExamHistoryHtml(){
  S.examHistory=S.examHistory||[];
  if(!S.examHistory.length)return'<p class="module-stat-hint">Aucun examen blanc encore</p>';
  return[...S.examHistory].reverse().map(ex=>{
    const d=new Date(ex.date);
    const df=d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
    const pct=Math.round((ex.scoreGlobal||0)*100);
    const sec=ex.dureeSecondes||0;
    const mm=Math.floor(sec/60);
    const rsec=sec%60;
    return`<div class="exam-hist-row"><span>${eh(df)}</span><span class="exam-hist-pct">${pct}%</span><span>${mm} min ${rsec} s</span></div>`;
  }).join('');
}

function getRevisionPhaseContent(daysLeft){
  if(daysLeft===null||daysLeft===undefined)return{
    phase:'Phase 1 — Fondations',
    periode:'J-60 à J-40',
    focus:'Théorie + Infractions',
    taches:['Compléter les modules 1 à 6','Apprendre les triptyques (F01–F39)','Flashcards quotidiennes (15 min)','1 QCM express par jour']
  };
  if(daysLeft>40)return{
    phase:'Phase 1 — Fondations',
    periode:'J-60 à J-40',
    focus:'Théorie + Infractions',
    taches:['Compléter les modules 1 à 6','Apprendre les triptyques (F01–F39)','Flashcards quotidiennes — 15 min/jour','1 QCM express par jour']
  };
  if(daysLeft>14)return{
    phase:'Phase 2 — Consolidation',
    periode:'J-40 à J-14',
    focus:'Simulateur oral + PV',
    taches:['Compléter les modules 7 à 14','Maîtriser les 64 infractions (F01–F64)','2 simulations orales par semaine','Révision FSRS quotidienne — 20 min/jour']
  };
  if(daysLeft>0)return{
    phase:'Phase 3 — Affûtage',
    periode:'J-14 à J-1',
    focus:'Examens blancs + ciblage lacunes',
    taches:['1 examen blanc par semaine','Ciblage intensif des modules faibles','Révision canevas PV (1 par jour)','Flashcards intensives — 30 min/jour']
  };
  if(daysLeft===0)return{
    phase:'Jour J — Dernière révision',
    periode:'Le matin de l\'examen',
    focus:'Confiance uniquement',
    taches:['10 questions les plus ratées — pas plus','5 infractions les moins mémorisées','PAS de nouveau contenu aujourd\'hui','Relire 1 fiche synthèse du module le plus faible']
  };
  return{
    phase:'Post-examen',
    periode:'',
    focus:'Maintien ou prochaine session',
    taches:['Analyser les points faibles identifiés','Maintenir le streak quotidien','Préparer la prochaine session si nécessaire']
  };
}

function renderRevisionPlan(){
  const el=document.getElementById('pr-plan-content');
  if(!el)return;
  const daysLeft=S.user?.examDate?daysUntilExam(S.user.examDate):null;
  const plan=getRevisionPhaseContent(daysLeft);
  const focusLabel=plan.focus?`<p class="rp-focus">${eh(plan.focus)}</p>`:'';
  const periodeLabel=plan.periode?`<span class="rp-periode">${eh(plan.periode)}</span>`:'';
  el.innerHTML=`
    <div class="rp-header">
      <span class="rp-phase">${eh(plan.phase)}</span>
      ${periodeLabel}
    </div>
    ${focusLabel}
    <ul class="rp-tasks">
      ${plan.taches.map(t=>`<li class="rp-task-item">${eh(t)}</li>`).join('')}
    </ul>
  `;
}

function startDueSession(){
  const due=typeof FSRS!=='undefined'&&FSRS.getDueFlashcards?FSRS.getDueFlashcards(S.flashFsrs):[];
  if(!due.length){showToast('Aucune fiche due pour l’instant','ok');return;}
  S.fsDueSession={ids:due.map(f=>f.id)};
  save();
  navigateTo('revision');
  setTimeout(()=>{
    try{
      setRevTab('fiches');
      openFiche(S.fsDueSession.ids[0]);
    }catch(e){console.warn('startDueSession',e);}
  },100);
}

function nextDueFiche(){
  if(!S.fsDueSession?.ids?.length)return;
  const cur=S._ficheOpenId;
  const ix=S.fsDueSession.ids.indexOf(cur);
  if(ix<0)return;
  if(ix+1>=S.fsDueSession.ids.length){
    endDueFicheSession(true);
    return;
  }
  openFiche(S.fsDueSession.ids[ix+1]);
}

function endDueFicheSession(doneMsg){
  const jjRev=!!S._jjRevision;
  if(jjRev)S._jjRevision=false;
  S.fsDueSession=null;
  S._ficheOpenId=null;
  try{save();}catch(e){}
  const ov=document.getElementById('fiche-ov');
  if(ov){ov.style.display='none';ov.style.alignItems='flex-end';}
  document.body.style.overflow='';
  try{renderBubbles();}catch(e){}
  if(doneMsg){
    if(jjRev)showToast('Bonne chance pour ton examen 🎯','ok');
    else showToast('Session fiches dues terminée','ok');
  }
}

/** Home : fiches FSRS dues → oral faible → QCM dus → leçon → révision. */
function continueProgress(){
  const dueFlash=typeof FSRS!=='undefined'&&FSRS.getDueFlashcards?FSRS.getDueFlashcards(S.flashFsrs):[];
  if(dueFlash.length>0){
    startDueSession();
    return;
  }
  const weakT=getWeakestOralTheme();
  if(weakT){
    navigateTo('revision');
    setTimeout(()=>{
      try{
        setRevTab('entrainement');
        oralStartSession(weakT);
      }catch(e){console.warn('continueProgress oral',e);}
    },100);
    return;
  }
  const due=QB.filter(q=>FSRS.isDue(S.qcm.cards[q.id]));
  if(due.length>0){
    startSmartSession();
    return;
  }
  const nextL=getNextUnseenLessonId();
  if(nextL){
    navigateTo('lecons');
    setTimeout(()=>{try{openLesson(nextL);}catch(e){}},120);
    return;
  }
  showToast('Tout est à jour — lance une session de révision !','ok');
  navigateTo('revision');
}

function tapContinueHome(){
  haptic(14);
  const b=document.querySelector('.btn-continue-v2,.btn-continue');
  if(b){b.classList.add('btn-continue--tap');setTimeout(()=>b.classList.remove('btn-continue--tap'),320);}
  continueProgress();
}

/* ─── RENDER HOME ─── */
function renderHome(){
  const g=getGrade(),n=getNextGrade(),pct=getXPPct();
  const el=id=>document.getElementById(id);
  const hour=new Date().getHours();
  const greet=hour<12?'Bonjour':hour<18?'Bon après-midi':'Bonsoir';
  const parts=(S.user.name||'OPJ').trim().split(/\s+/);
  const firstName=parts[0]||'Officier';
  const streakN=S.user.streak||0;
  if(el('h-greeting'))el('h-greeting').textContent=greet+',';
  if(el('h-name'))el('h-name').textContent=firstName;
  if(el('h-grade-name'))el('h-grade-name').textContent=g.name;
  if(el('h-grade-ico-sm'))el('h-grade-ico-sm').innerHTML=gradeSvg(g);
  if(el('h-streak'))el('h-streak').textContent=String(streakN);
  const smult=getStreakMultiplier();
  const smultEl=el('h-streak-mult');
  if(smultEl)smultEl.innerHTML=smult>1?'<span class="streak-mult">×'+smult.toFixed(1)+'</span>':'';
  const streakUnit=el('h-streak-unit');
  if(streakUnit)streakUnit.textContent=streakN>1?'jours':'jour';
  const streakRow=el('h-streak-row');
  if(streakRow)streakRow.classList.toggle('hero-streak--pulse',streakN>3);
  const nextNameEl=el('h-xp-next-name');
  if(nextNameEl)nextNameEl.textContent=n?n.name:'Max';
  if(el('h-grade-badge'))el('h-grade-badge').innerHTML=gradeSvg(g);
  if(el('h-xpbar'))el('h-xpbar').style.width=pct+'%';
  if(el('h-xp-meta')){
    const meta=n?`${S.user.xp} / ${n.min} XP`:(S.user.xp+' XP · max');
    el('h-xp-meta').textContent=meta;
  }
  const lessonsDone=Object.keys(S.lessons).length;
  if(el('h-lessons-done'))el('h-lessons-done').textContent=lessonsDone;
  if(el('h-qcm-done'))el('h-qcm-done').textContent=Object.keys(S.qcm.cards).length;
  const ecEl=document.getElementById('h-exam-countdown');
  let daysLeftHero=null;
  if(S.user.examDate){
    const daysLeft=daysUntilExam(S.user.examDate);
    daysLeftHero=daysLeft;
    if(daysLeft!==null){
      if(el('h-exam-days'))el('h-exam-days').textContent=daysLeft>0?String(daysLeft):(daysLeft===0?'Jour J':'Passé');
      const sub=el('h-exam-session');
      if(sub)sub.textContent='Objectif : '+formatExamSessionLabel(S.user.examDate);
      const ph=el('h-exam-phase');
      if(ph){
        const phInf=examPhaseLabel(daysLeft);
        ph.textContent=phInf.icon+' Phase '+phInf.lbl+' — '+phInf.txt;
      }
      if(ecEl){
        ecEl.style.display='flex';
        ecEl.classList.remove('countdown--calm','countdown--warn','countdown--urgent');
        const cdCls=daysLeft<0?'countdown--calm':daysLeft<=14?'countdown--urgent':daysLeft<=40?'countdown--warn':'countdown--calm';
        ecEl.classList.add(cdCls);
      }
    }else{
      if(ecEl)ecEl.style.display='none';
      const phBad=el('h-exam-phase');if(phBad)phBad.textContent='';
    }
  }else{
    if(ecEl)ecEl.style.display='none';
    const ph0=el('h-exam-phase');if(ph0)ph0.textContent='';
  }
  const hExamAct=document.getElementById('h-exam-hero-actions');
  if(hExamAct){
    if(daysLeftHero!==null){
      let h='';
      if(daysLeftHero===0||daysLeftHero===1)h+='<button type="button" id="btn-revision-jour-j" class="btn btn-warning btn-revision-j" onclick="startRevisionJourJ()">🎯 Révision Jour J</button>';
      if(daysLeftHero<=40&&daysLeftHero>=0)h+='<button type="button" id="btn-examen-blanc-hero" class="btn-primary" onclick="startExamenBlanc()">📋 Examen blanc</button>';
      hExamAct.innerHTML=h;
      hExamAct.style.display=h?'flex':'none';
    }else{
      hExamAct.innerHTML='';
      hExamAct.style.display='none';
    }
  }
  if(el('h-pro-teaser'))el('h-pro-teaser').style.display=(S.isPro||S.user.isPRO)?'none':'flex';
  const sw=document.getElementById('h-streak-warning');
  if(sw){
    const today=new Date().toDateString();
    const gapH=S.lastBgAt?(Date.now()-S.lastBgAt)/3600000:0;
    const show=S.user.streak>0&&gapH>=20&&!S.activity?.[today];
    sw.classList.toggle('on',!!show);
  }
  renderWeakWidget();
  renderChapterProgress();
  try{renderQDJ();}catch(e){}
  try{if(typeof showNotifPermissionBanner==='function')showNotifPermissionBanner();}catch(_){}
  const placementEl=document.getElementById('placement-card');
  if(placementEl)placementEl.style.display=S.placementDone?'none':'flex';
}

function renderChapterProgress(){if(typeof CHAPTERS==='undefined'||!CHAPTERS)return;
  const el=document.getElementById('h-chapter-progress');if(!el)return;
  el.innerHTML=CHAPTERS.slice(0,6).map(ch=>{
    const done=ch.lessons.filter(l=>S.lessons[l.id]).length;
    const pct=Math.round(done/ch.lessons.length*100);
    return`<div class="ch-prog-row">
      <span class="ch-prog-icon">${ch.icon}</span>
      <div class="ch-prog-inf">
        <div class="ch-prog-name">${ch.title}</div>
        <div class="ch-prog-bar"><div class="ch-prog-fill" style="width:${pct}%;background:${ch.color}"></div></div>
      </div>
      <span class="ch-prog-pct">${done}/${ch.lessons.length}</span>
    </div>`;
  }).join('')+`<div style="margin-top:10px;text-align:center"><button class="btn btn-ghost btn-sm" onclick="navigateTo('lecons')" style="font-size:11px">Voir toutes les leçons →</button></div>`;
}

function renderWeakWidget(){
  const el=document.getElementById('h-weak-widget');if(!el)return;
  const THEMES_DEF=[
    {cat:'GAV',name:'Garde à Vue',em:'🔒'},
    {cat:'FLAGRANCE',name:'Flagrance',em:'🚨'},
    {cat:'PERQUIZ',name:'Perquisitions',em:'🔍'},
    {cat:'MANDATS',name:'Mandats',em:'📋'},
    {cat:'INFRACTIONS',name:'Infractions',em:'⚡'},
    {cat:'PRESCRIP',name:'Prescription',em:'⏳'},
    {cat:'LIBERTES',name:'Libertés',em:'🏛️'},
    {cat:'INSTRUCTION',name:'Instruction',em:'🏛️'},
  ];
  const zones=THEMES_DEF.map(t=>{
    const m=computeMastery(t.cat);
    if(!m.total||!m.done)return null;
    return{...t,pct:m.mastery,done:m.done};
  }).filter(Boolean).filter(z=>z.pct<70).sort((a,b)=>a.pct-b.pct).slice(0,3);
  if(!zones.length){el.innerHTML='';el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML=`<div class="weak-widget">
    <div class="weak-widget-title">⚠️ Zones à renforcer</div>
    ${zones.map(z=>`<div class="weak-row">
      <span style="font-size:14px">${z.em}</span>
      <div style="flex:1;min-width:0">
        <div class="flex-b"><span class="weak-name">${z.name}</span><span class="weak-pct">${z.pct}%</span></div>
        <div class="weak-bar"><div class="weak-fill" style="width:${z.pct}%"></div></div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="startSession('${z.cat}')" style="font-size:10px;padding:5px 8px">Travailler</button>
    </div>`).join('')}
  </div>`;
}

/* ─── LOCKED LESSON PATH HELPERS ─── */
function isLessonUnlocked(chapter, lessonIndex){
  if(lessonIndex===0)return true;
  const prevLesson=chapter.lessons[lessonIndex-1];
  return !!S.lessons[prevLesson.id];
}

/* ─── RENDER LEÇONS ─── */
function renderLecons(){
  const totalLessons=CHAPTERS.reduce((a,c)=>a+c.lessons.length,0);
  const done=Object.keys(S.lessons).length;
  const pct=Math.round(done/totalLessons*100);
  const el=id=>document.getElementById(id);
  if(el('lec-global-prog'))el('lec-global-prog').textContent=done+' leçon'+(done>1?'s':'')+' vue'+(done>1?'s':'')+' sur '+totalLessons;
  if(el('lec-pct'))el('lec-pct').textContent=pct+'%';
  if(el('lec-xpbar'))el('lec-xpbar').style.width=pct+'%';
  const list=el('chapters-list');if(!list)return;
  renderSkeletons('chapters-list',4,56);
  clearTimeout(window._skLec);
  window._skLec=setTimeout(()=>{
    const listEl=document.getElementById('chapters-list');if(!listEl)return;
    listEl.innerHTML=CHAPTERS.map(ch=>{
    const doneCh=ch.lessons.filter(l=>S.lessons[l.id]).length;
    const pctCh=Math.round(doneCh/ch.lessons.length*100);
    return`<div class="chapter-card" id="ch-${ch.id}"
  style="--ch-color:${ch.color}"
  onclick="toggleChapter('${ch.id}')">
  <div class="chapter-hd">
    <div class="chapter-ico" style="background:${ch.bg}">${ch.icon}</div>
    <div class="chapter-inf">
      <div class="chapter-num">Chapitre ${ch.num}</div>
      <div class="chapter-title">${ch.title}</div>
      <div class="chapter-sub">${ch.sub}</div>
    </div>
    <div class="chapter-meta">
      <span class="chapter-prog-txt">${doneCh}/${ch.lessons.length}</span>
      <span class="chapter-arrow">›</span>
    </div>
  </div>
  <div class="chapter-prog-bar-wrap">
    <div class="chapter-prog-bar-fill"
      style="width:${pctCh}%;background:${ch.color}">
    </div>
  </div>
  <div class="chapter-lessons" id="lessons-${ch.id}">
    ${ch.lessons.map((l,idx) => {
      const done = !!S.lessons[l.id];
      const unlocked = isLessonUnlocked(ch, idx);
      const isCurrent = unlocked && !done;
      const nodeClass = 'lesson-item lesson-node' + (done?' completed':(!unlocked?' locked':(isCurrent?' current':'')));
      const connector = idx > 0 ? '<div class="lesson-connector'+(!!S.lessons[ch.lessons[idx-1].id]?' done':'')+'"></div>' : '';
      return connector + '<div class="'+nodeClass+'"' +
        ' onclick="'+(unlocked?'openLesson(\''+l.id+'\');event.stopPropagation()':'showToast(\'Termine d\\\'abord la leçon précédente\',\'err\');event.stopPropagation()')+'">' +
        '<span class="lesson-em">'+(unlocked?l.em:'🔒')+'</span>' +
        '<div class="lesson-inf">' +
          '<div class="lesson-name">'+l.name+'</div>' +
          '<div class="lesson-meta">'+l.ref+'</div>' +
        '</div>' +
        (unlocked?'<span class="lesson-xp-badge">+'+l.xp+' XP</span>':'') +
        '<div class="lesson-status '+(done?'done':(!unlocked?'locked-status':'new'))+'">' +
          (done?'✓':(!unlocked?'🔒':'→')) +
        '</div>' +
      '</div>';
    }).join('')}
  </div>
</div>`;
  }).join('');
  },150);
}

function toggleChapter(id){
  document.getElementById('ch-'+id)?.classList.toggle('expanded');
}

function openLesson(id){
  const lesson=CHAPTERS.flatMap(c=>c.lessons).find(l=>l.id===id);if(!lesson)return;
  const chapter=CHAPTERS.find(c=>c.lessons.some(l=>l.id===id));
  const isDone=!!S.lessons[id];
  let html=`<div class="lesson-chapter-badge" style="background:${chapter.bg};color:${chapter.color}">${eh(chapter.icon)} ${eh(chapter.title)}</div>`;
  html+=`<div class="lesson-modal-title">${eh(lesson.em)} ${eh(lesson.name)}</div>`;
  html+=`<div class="lesson-modal-ref">${eh(lesson.ref)}</div>`;
  /* NOTE: lesson.intro, s.items, s.table, lesson.traps, lesson.keys contain editorial HTML — not escaped */
  if(lesson.intro)html+=`<div class="lesson-intro">${lesson.intro}</div>`;
  (lesson.secs||[]).forEach(s=>{
    html+=`<div class="lesson-sec-title">${eh(s.t)}</div>`;
    if(s.table){
      /* Table leçon : wrapper overflow déjà présent — pas de .table-scroll redondant (correction audit) */
      html+=`<div style="overflow-x:auto;margin-bottom:7px"><table class="art-table"><thead><tr>${s.table.th.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }else{
      (s.items||[]).forEach(it=>html+=`<div class="lesson-block">${it}</div>`);
    }
  });
  if(lesson.traps?.length)lesson.traps.forEach(t=>html+=`<div class="lesson-trap"><div class="lesson-trap-lbl">⚠️ Piège d'examen</div><div class="lesson-trap-txt">${t}</div></div>`);
  if(lesson.keys?.length)html+=`<div class="lesson-keys"><div class="lesson-keys-lbl">⚡ À retenir</div>${lesson.keys.map(k=>`<div class="lesson-key-item">${k}</div>`).join('')}</div>`;
  html+=`<div style="margin-top:18px">
    <button class="btn btn-p" onclick="markLessonDone('${id}')" style="${isDone?'background:var(--ok-bg);border:1px solid var(--ok);color:var(--ok)':''}">
      ${isDone?'✅ Leçon maîtrisée — Relire':'✓ Marquer comme vue · +'+lesson.xp+' XP'}
    </button>
    <button class="btn btn-ghost btn-full mt8" onclick="closeLesson()">Fermer</button>
  </div>`;
  const _lmb=document.getElementById('lesson-modal-body');if(_lmb)_lmb.innerHTML=html;
  const _lov=document.getElementById('lesson-ov');if(_lov)_lov.classList.add('on');
  document.body.style.overflow='hidden';
}
function closeLesson(){
  const _lov=document.getElementById('lesson-ov');if(_lov)_lov.classList.remove('on');
  document.body.style.overflow='';
}
function markLessonDone(id){
  if(!S.lessons[id]){
    const lesson=CHAPTERS.flatMap(c=>c.lessons).find(l=>l.id===id);
    const xp=lesson?.xp||10;
    S.lessons[id]=Date.now();
    addXP(xp);
    save();haptic(50);
    closeLesson();renderLecons();renderChapterProgress();
    showLessonCompleteOverlay(id,xp);
    return;
  }
  closeLesson();renderLecons();renderChapterProgress();
}
function showLessonCompleteOverlay(lessonId,xpGained){
  const ov=document.getElementById('lesson-complete-ov');if(!ov)return;
  const grade=getGrade();
  const icoEl=document.getElementById('lc-grade-ico');
  const nmEl=document.getElementById('lc-grade-name');
  const xpEl=document.getElementById('lc-xp-line');
  if(icoEl)icoEl.innerHTML=gradeSvg(grade);
  if(nmEl)nmEl.textContent=grade.name;
  if(xpEl)xpEl.textContent='+'+xpGained+' XP';
  ov.removeAttribute('inert');
  confetti(true);
}
function closeLessonComplete(){
  const ov=document.getElementById('lesson-complete-ov');
  if(ov)ov.setAttribute('inert','');
  continueProgress();
}

/* ─── RENDER RÉVISION ─── */
function normalizeRevTab(t){
  if(!t)return'reviser';
  const legacy={qcm:'reviser',proc:'fiches',libertes:'fiches',blitz:'entrainement',classer:'entrainement',imprimer:'ressources',annales:'ressources'};
  return legacy[t]||t;
}
/* ─── Alertes intelligentes pour la page Révision (banque QCM QB) ─── */
function formatCatLabel(cat){
  const MAP={
    GAV:'Garde à vue',FLAGRANCE:'Flagrance',PERQUIZ:'Perquisitions',AUDLIB:'Audition libre',
    MANDATS:'Mandats',INSTRUCTION:'Instruction',MINEURS:'Mineurs',CRIMORG:'Criminalité organisée',
    CDO:'CDO',FICHIERS:'Fichiers',LIBERTES:'Libertés publiques',CONTROLES:'Contrôles d\'identité',
    STUPS:'Stupéfiants',VIOLENCES_CONJ:'Violences conjugales',INFRACTIONS:'Infractions',
    INFRACTIONS_PUB:'Infractions publiques',NULLITES:'Nullités',COMMISSION:'Commission rogatoire',
    CYBER:'Cybercriminalité',EUROP:'Droit européen',ATTEINTES_LIBERTE:'Atteintes aux libertés',
    PROBATION:'Probation',ACTION_PUB:'Action publique',ENQUETES_SPEC:'Enquêtes spéciales',
    MESURES_COERC:'Mesures coercitives',PRESCRIP:'Prescription',PATRIMONIAL:'Patrimonial',
    TAJ:'TAJ',RECIDIVE:'Récidive',OPJ:'OPJ',LEGDEF:'Légitime défense',ALTERNATIVES:'Alternatives aux poursuites',
    REQS:'Réquisitions'
  };
  if(typeof cat!=='string'||!cat)return'';
  return MAP[cat]||cat.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
function getSmartAlerts(){
  const alerts=[];
  const now=Date.now();
  const cards=S.qcm?.cards||{};
  const bank=(typeof QB!=='undefined'?QB:window.QB)||[];
  if(!bank.length)return alerts;
  const catLastReview={};
  for(const[id,card]of Object.entries(cards)){
    if(!card||!card.due)continue;
    const q=bank.find(x=>x.id===id);
    if(!q||!q.cat)continue;
    const lastReview=card.due-(card.interval||1)*86400000;
    if(!catLastReview[q.cat]||lastReview>catLastReview[q.cat])catLastReview[q.cat]=lastReview;
  }
  for(const[cat,lastDate]of Object.entries(catLastReview)){
    const daysSince=Math.floor((now-lastDate)/86400000);
    if(daysSince>=7){
      alerts.push({
        type:'neglected',
        icon:'⚠️',
        text:formatCatLabel(cat)+' non révisé depuis '+daysSince+' jours',
        priority:daysSince
      });
    }
  }
  const catStats={};
  for(const[id,card]of Object.entries(cards)){
    if(!card||(card.reps||0)===0)continue;
    const q=bank.find(x=>x.id===id);
    if(!q||!q.cat)continue;
    if(!catStats[q.cat])catStats[q.cat]={ok:0,total:0};
    catStats[q.cat].total++;
    if((card.ok||0)>(card.ko||0))catStats[q.cat].ok++;
  }
  for(const[cat,stats]of Object.entries(catStats)){
    if(stats.total<5)continue;
    const rate=Math.round(stats.ok/stats.total*100);
    if(rate<50){
      alerts.push({
        type:'weak',
        icon:'🔴',
        text:formatCatLabel(cat)+' en difficulté ('+rate+'%)',
        priority:100-rate
      });
    }
  }
  if(S.user?.examDate){
    try{
      const daysLeft=typeof daysUntilExam==='function'?daysUntilExam(S.user.examDate):null;
      if(daysLeft!==null&&daysLeft>0&&daysLeft<=30){
        const touchedCats=new Set(Object.keys(catStats));
        const allCats=[...new Set(bank.map(q=>q.cat).filter(Boolean))];
        const unstarted=allCats.filter(c=>!touchedCats.has(c));
        if(unstarted.length>0){
          alerts.push({
            type:'urgent',
            icon:'🚨',
            text:'J-'+daysLeft+' : '+unstarted.length+' thème(s) jamais révisé(s)',
            priority:200
          });
        }
      }
    }catch(_){}
  }
  return alerts.sort((a,b)=>b.priority-a.priority).slice(0,3);
}
function renderSmartAlerts(){
  const host=document.getElementById('rev-smart-alerts');
  if(!host)return'';
  const alerts=getSmartAlerts();
  if(!alerts.length){
    host.innerHTML='';
    host.style.display='none';
    return'';
  }
  host.style.display='';
  host.innerHTML='<div class="smart-alerts-wrap">'+alerts.map(a=>{
    const cls=a.type==='urgent'?' smart-alert--urgent':'';
    return'<div class="smart-alert'+cls+'" role="status">'+
      '<span class="smart-alert-icon" aria-hidden="true">'+a.icon+'</span>'+
      '<span class="smart-alert-text">'+eh(a.text)+'</span></div>';
  }).join('')+'</div>';
  return host.innerHTML;
}
function renderRevision(){
  renderSmartAlerts();
  renderRevThemes();renderBubbles();renderProcList();updateDueCount();
  setRevTab(normalizeRevTab(S.rev?.tab)||'reviser');
  const erCard=document.getElementById('error-review-card');
  if(erCard){
    const hasErrors=S.errorLog&&Object.keys(S.errorLog).length>0;
    erCard.style.display=hasErrors?'flex':'none';
    if(hasErrors){
      const sorted=Object.entries(S.errorLog).sort((a,b)=>b[1]-a[1]).slice(0,3);
      const subEl=document.getElementById('er-sub-text');
      if(subEl)subEl.textContent=sorted.map(e=>e[0]).join(', ');
    }
  }
}
function setRevTab(tab){
  S.rev=S.rev||{};
  tab=normalizeRevTab(tab);
  if(tab!=='fiches')_activeFam=null;
  S.rev.tab=tab;
  const tabs=['reviser','fiches','procedures','entrainement','ressources'];
  tabs.forEach(t=>{
    document.getElementById('rtab-'+t)?.classList.toggle('on',t===tab);
    document.getElementById('rmc-'+t)?.classList.toggle('on',t===tab);
    const c=document.getElementById('rtab-'+t+'-content');
    if(c)c.style.display=t===tab?'block':'none';
  });
  if(tab==='fiches'){try{renderBubbles();}catch(e){}}
  if(tab==='procedures'){try{renderProcList();if(typeof LP!=='undefined')LP.render();}catch(e){}}
  if(tab==='ressources'){renderAnnalesList();renderPrintList();}
  if(tab==='entrainement'){
    const best=S.blitzBest||0;
    const el=document.getElementById('blitz-best-display');
    if(el&&best>0)el.textContent='Meilleur score : '+best+'/10';
    try{renderOralMode();}catch(e){console.warn('renderOralMode',e);}
  }
}
/* ─── ENTRAÎNEMENT ORAL (session + overlay) ─── */
let ORAL_SESSION=null;
let examBlancTimerId=null;
let examBlancSession=null;
let jourJSession=null;
function oralShuffle(a){const t=[...a];for(let i=t.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[t[i],t[j]]=[t[j],t[i]];}return t;}
function ensureOralOv(){
  let ov=document.getElementById('oral-ov');
  if(!ov){
    ov=document.createElement('div');
    ov.id='oral-ov';
    ov.className='oral-ov';
    ov.setAttribute('inert','');
    document.body.appendChild(ov);
  }
  return ov;
}
function oralOpenOv(){
  const ov=ensureOralOv();
  ov.classList.add('show');
  ov.removeAttribute('inert');
  document.body.style.overflow='hidden';
}
function oralCloseOv(){
  const ov=document.getElementById('oral-ov');
  if(ov){
    ov.classList.remove('show');
    ov.setAttribute('inert','');
    ov.innerHTML='';
  }
  document.body.style.overflow='';
}
function renderOralMode(){
  const root=document.getElementById('oral-mode-root');
  if(!root)return;
  S.oral=S.oral||{done:{},scores:{}};
  const doneN=Object.keys(S.oral.done||{}).filter(id=>S.oral.done[id]).length;
  const total=ORAL_QB.length;
  const byTheme={};
  ORAL_QB.forEach(q=>{if(!byTheme[q.theme])byTheme[q.theme]=[];byTheme[q.theme].push(q);});
  root.innerHTML=`
<div class="oral-search-block">
  <label class="oral-search-lbl" for="oral-search">Recherche par article (CPP, CP…)</label>
  <input type="search" id="oral-search" class="oral-search-inp" placeholder="ex. 62-2, 706-88, 122-4…" autocomplete="off" oninput="oralOnSearchInput()"/>
  <div id="oral-search-results"></div>
</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--t3);margin-bottom:6px">${doneN} / ${total} sujets traités</div>
<div class="slbl" style="margin-top:4px;margin-bottom:8px">Par thème (5 questions / session)</div>
<div id="oral-theme-cards">`+ORAL_THEME_META.map(meta=>{
  const list=byTheme[meta.key]||[];
  if(!list.length)return'';
  const maxN=Math.max(...list.map(q=>q.niveau),1);
  const minN=Math.min(...list.map(q=>q.niveau),3);
  const doneTh=list.filter(q=>S.oral.done[q.id]).length;
  const badge=maxN===minN?`Niv. ${maxN}`:`Niv. ${minN}–${maxN}`;
  return`<div class="mode-card mode-card--oral" style="margin-bottom:10px;align-items:flex-start;">
  <div style="font-size:22px;flex-shrink:0">${meta.emoji}</div>
  <div class="mode-card-body" style="flex:1;min-width:140px">
    <div class="mode-card-title">${meta.label}</div>
    <div class="mode-card-sub">${list.length} question${list.length>1?'s':''} · ${doneTh}/${list.length} réalisée${doneTh!==1?'s':''}</div>
    <span class="mode-tag" style="margin-top:6px;display:inline-block">${badge}</span>
  </div>
  <button type="button" onclick="event.stopPropagation();oralStartSession('${meta.key}')" style="padding:6px 12px;background:var(--accent);color:#fff;border:none;border-radius:16px;font-size:11px;font-weight:700;cursor:pointer;font-family:'JetBrains Mono',monospace;margin-top:6px;align-self:flex-start;white-space:nowrap;">▶ Session</button>
</div>`;
}).join('')+`</div>`;
}
function startOralMode(){
  S.rev=S.rev||{};
  S.rev.tab='entrainement';
  navigateTo('revision');
  setTimeout(()=>{try{renderOralMode();document.getElementById('oral-mode-root')?.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){}},80);
}
function oralStartSession(themeKey,customQueue){
  let queue;
  let theme;
  if(customQueue&&customQueue.length){
    queue=oralShuffle([...customQueue]);
    const thSet=new Set(queue.map(q=>q.theme));
    theme=thSet.size===1?queue[0].theme:'MIX';
  }else if(themeKey){
    const pool=ORAL_QB.filter(q=>q.theme===themeKey);
    if(!pool.length){showToast('Aucune question pour ce thème','err');return;}
    queue=oralShuffle(pool).slice(0,Math.min(5,pool.length));
    theme=themeKey;
  }else{
    showToast('Aucune question','err');return;
  }
  ORAL_SESSION={theme,queue,qIndex:0,phase:1,pointIdx:0,known:0,timer:null,tRemaining:0,sessionXP:0};
  oralOpenOv();
  oralShowQuestion();
}
let _oralSearchT=null;
function oralOpenSingleQuestion(qid){
  const q=ORAL_QB.find(x=>x.id===qid);
  if(!q){showToast('Question introuvable','err');return;}
  oralStartSession(null,[q]);
}
function clearExamBlancGlobalTimer(){
  if(ORAL_SESSION&&ORAL_SESSION.examGlobalTimerId){
    clearInterval(ORAL_SESSION.examGlobalTimerId);
    ORAL_SESSION.examGlobalTimerId=null;
  }
}
function examBlancUpdateGlobalTimerDisplay(){
  const el=document.getElementById('oral-exam-global-timer');
  if(!el||!ORAL_SESSION||ORAL_SESSION.mode!=='exam-blanc')return;
  const s=Math.max(0,ORAL_SESSION.examSecsLeft||0);
  const mm=String(Math.floor(s/60)).padStart(2,'0');
  const ss=String(s%60).padStart(2,'0');
  el.textContent=mm+':'+ss;
}
function finishExamBlancOral(timedOut){
  if(!ORAL_SESSION||ORAL_SESSION.mode!=='exam-blanc')return;
  if(ORAL_SESSION.timer){clearInterval(ORAL_SESSION.timer);ORAL_SESSION.timer=null;}
  clearExamBlancGlobalTimer();
  const started=ORAL_SESSION.examStartedAt||Date.now();
  const dureeSecondes=Math.round((Date.now()-started)/1000);
  const stats=ORAL_SESSION.moduleStats||{};
  let bon=0,tot=0;
  Object.values(stats).forEach(x=>{bon+=x.bon;tot+=x.total;});
  const scoreGlobal=tot>0?bon/tot:0;
  const scoreParModule={};
  Object.entries(stats).forEach(([th,x])=>{scoreParModule[th]={bon:x.bon,total:x.total};});
  S.examHistory=S.examHistory||[];
  S.examHistory.push({date:new Date().toISOString(),scoreGlobal,scoreParModule,dureeSecondes});
  while(S.examHistory.length>5)S.examHistory.shift();
  S._examBlancPendingWrong=[...new Set(ORAL_SESSION.wrongQuestionIds||[])];
  const _xpEx=ORAL_SESSION.sessionXP||0;
  if(_xpEx>0)showXPPop(_xpEx);
  try{save();}catch(e){}
  const payload={scoreGlobal,scoreParModule,dureeSecondes,timedOut:!!timedOut};
  ORAL_SESSION=null;
  oralRenderExamBlancResults(payload);
}
function oralRenderExamBlancResults(data){
  const ov=ensureOralOv();
  ov.classList.add('show');
  ov.removeAttribute('inert');
  document.body.style.overflow='hidden';
  const pct=Math.round((data.scoreGlobal||0)*100);
  const dur=data.dureeSecondes||0;
  const dmm=String(Math.floor(dur/60)).padStart(2,'0');
  const dss=String(dur%60).padStart(2,'0');
  const pm=data.scoreParModule||{};
  const order=(typeof ORAL_THEME_META!=='undefined'&&ORAL_THEME_META.length)
    ?ORAL_THEME_META.map(m=>m.key).filter(k=>pm[k]!==undefined)
    :Object.keys(pm);
  const seen=new Set(order);
  Object.keys(pm).forEach(k=>{if(!seen.has(k))order.push(k);});
  const rows=order.map(themeKey=>{
    const s=pm[themeKey];
    const meta=(typeof ORAL_THEME_META!=='undefined'&&ORAL_THEME_META.length)?ORAL_THEME_META.find(m=>m.key===themeKey):null;
    const name=meta?meta.label:themeKey;
    const p=s.total>0?Math.round(s.bon/s.total*100):0;
    const col=p<50?'var(--err)':p<75?'var(--warn)':'var(--ok)';
    return`<tr><td>${eh(name)}</td><td>${p}%</td><td><div class="exam-mod-bar"><div class="exam-mod-fill" style="width:${p}%;background:${col}"></div></div></td></tr>`;
  }).join('');
  ov.innerHTML=`<div class="oral-ov-scroll exam-blanc-results">
<div style="text-align:center;padding:20px 0 12px">
  <div style="font-size:12px;color:var(--t3)">Examen blanc oral</div>
  <div style="font-size:52px;font-weight:900;color:var(--t1);line-height:1">${pct}%</div>
  <div style="font-size:13px;color:var(--t2)">Score global</div>
  <div style="margin-top:12px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--t3)">Durée réelle : ${dmm}:${dss}</div>
  ${data.timedOut?'<div style="color:var(--warn);font-size:12px;margin-top:10px">Temps imparti écoulé — fin automatique.</div>':''}
</div>
<div class="table-scroll"><table class="exam-blanc-mod-table" aria-label="Scores par module">
  <thead><tr><th>Module</th><th>Score</th><th></th></tr></thead>
  <tbody>${rows||'<tr><td colspan="3" style="color:var(--t3);text-align:center">Aucune question complétée</td></tr>'}</tbody>
</table></div>
<div style="display:flex;flex-direction:column;gap:10px;max-width:440px;margin:20px auto 0;width:100%">
  <button type="button" class="btn-main" onclick="startExamBlancErrorReview()">Revoir mes erreurs</button>
  <button type="button" class="btn-ghost" onclick="closeExamBlancResults()">Fermer</button>
</div>
</div>`;
}
function closeExamBlancResults(){
  oralCloseOv();
  try{renderOralMode();}catch(e){}
}
function startExamBlancErrorReview(){
  const ids=S._examBlancPendingWrong||[];
  const qs=[...new Set(ids)].map(id=>ORAL_QB.find(q=>q.id===id)).filter(Boolean);
  S._examBlancPendingWrong=null;
  try{save();}catch(e){}
  oralCloseOv();
  if(!qs.length){
    startSmartSession();
    return;
  }
  oralStartSession(null,qs);
}
function startExamBlancOral(){
  clearExamBlancGlobalTimer();
  const queue=buildExamBlancQuestions();
  if(!queue.length){showToast('Banque orale indisponible pour l’examen blanc.','err');return;}
  const moduleStats={};
  queue.forEach(q=>{
    if(!moduleStats[q.theme])moduleStats[q.theme]={bon:0,total:0};
  });
  ORAL_SESSION={
    theme:'EXAM_BLANC',
    queue,
    qIndex:0,
    phase:1,
    pointIdx:0,
    known:0,
    timer:null,
    tRemaining:0,
    sessionXP:0,
    mode:'exam-blanc',
    skipGamification:false,
    examStartedAt:Date.now(),
    examSecsLeft:2700,
    examGlobalTimerId:null,
    moduleStats,
    wrongQuestionIds:[]
  };
  oralOpenOv();
  ORAL_SESSION.examGlobalTimerId=setInterval(()=>{
    if(!ORAL_SESSION||ORAL_SESSION.mode!=='exam-blanc')return;
    ORAL_SESSION.examSecsLeft--;
    examBlancUpdateGlobalTimerDisplay();
    if(ORAL_SESSION.examSecsLeft<=0){
      clearExamBlancGlobalTimer();
      finishExamBlancOral(true);
    }
  },1000);
  oralShowQuestion();
  examBlancUpdateGlobalTimerDisplay();
}
function oralOnSearchInput(){
  clearTimeout(_oralSearchT);
  _oralSearchT=setTimeout(()=>{
    const out=document.getElementById('oral-search-results');
    const inp=document.getElementById('oral-search');
    if(!out||!inp)return;
    const snip=inp.value.trim();
    if(snip.length<2){out.innerHTML='';return;}
    const hits=searchOralByArticleSnippet(snip);
    if(!hits.length){out.innerHTML='<div class="oral-search-empty">Aucune question orale pour cet article.</div>';return;}
    out.innerHTML='<div class="oral-search-hd">Questions liées</div>'+hits.slice(0,14).map(qo=>{
      const arts=(qo.articles||[]).map(a=>eh(a)).join(' · ');
      const qq=qo.q.length>100?qo.q.slice(0,98)+'…':qo.q;
      return`<button type="button" class="oral-hit-row" onclick="oralOpenSingleQuestion('${qo.id}')"><div class="oral-hit-arts">${arts}</div><div class="oral-hit-q">${eh(qq)}</div></button>`;
    }).join('');
  },200);
}
function oralUpdateChrono(){
  const el=document.getElementById('oral-chrono');
  if(el&&ORAL_SESSION)el.textContent=String(Math.max(0,ORAL_SESSION.tRemaining));
}
function oralShowQuestion(){
  if(!ORAL_SESSION)return;
  if(ORAL_SESSION.timer){clearInterval(ORAL_SESSION.timer);ORAL_SESSION.timer=null;}
  const q=ORAL_SESSION.queue[ORAL_SESSION.qIndex];
  ORAL_SESSION.phase=1;
  ORAL_SESSION.pointIdx=0;
  ORAL_SESSION.known=0;
  ORAL_SESSION.tRemaining=q.duree;
  oralRenderOv();
  ORAL_SESSION.timer=setInterval(()=>{
    ORAL_SESSION.tRemaining--;
    oralUpdateChrono();
    if(ORAL_SESSION.tRemaining<=0){
      clearInterval(ORAL_SESSION.timer);
      ORAL_SESSION.timer=null;
      oralReady();
    }
  },1000);
  if(ORAL_SESSION.mode==='exam-blanc')examBlancUpdateGlobalTimerDisplay();
}
function oralReady(){
  if(!ORAL_SESSION)return;
  if(ORAL_SESSION.timer){clearInterval(ORAL_SESSION.timer);ORAL_SESSION.timer=null;}
  ORAL_SESSION.phase=2;
  ORAL_SESSION.pointIdx=0;
  oralRenderOv();
}
function oralPointAnswer(knew){
  if(!ORAL_SESSION)return;
  const q=ORAL_SESSION.queue[ORAL_SESSION.qIndex];
  if(knew)ORAL_SESSION.known++;
  ORAL_SESSION.pointIdx++;
  if(ORAL_SESSION.pointIdx>=q.points.length)oralEnterPhase3();
  else oralRenderOv();
}
function oralEnterPhase3(){
  if(!ORAL_SESSION)return;
  const q=ORAL_SESSION.queue[ORAL_SESSION.qIndex];
  const xp=ORAL_SESSION.known*10;
  ORAL_SESSION.sessionXP+=xp;
  ORAL_SESSION.phase=3;
  S.oral=S.oral||{done:{},scores:{}};
  S.oral.done[q.id]=true;
  const prev=S.oral.scores[q.id]||0;
  S.oral.scores[q.id]=Math.max(prev,ORAL_SESSION.known);
  if(ORAL_SESSION.mode==='exam-blanc'){
    const totPts=q.points.length;
    const st=ORAL_SESSION.moduleStats[q.theme];
    if(st){
      st.total++;
      if(ORAL_SESSION.known>=totPts)st.bon++;
    }
    if(ORAL_SESSION.known<totPts)ORAL_SESSION.wrongQuestionIds.push(q.id);
  }
  if(!ORAL_SESSION.skipGamification)addXP(xp);
  oralRenderOv();
}
function oralNextQuestion(){
  if(!ORAL_SESSION)return;
  ORAL_SESSION.qIndex++;
  if(ORAL_SESSION.qIndex>=ORAL_SESSION.queue.length)oralFinishSession();
  else oralShowQuestion();
}
function oralFinishSession(){
  if(ORAL_SESSION&&ORAL_SESSION.mode==='exam-blanc'){
    finishExamBlancOral(false);
    return;
  }
  const _xpOr=ORAL_SESSION?.sessionXP||0;
  if(_xpOr>0)showXPPop(_xpOr);
  ORAL_SESSION=null;
  oralCloseOv();
  try{renderOralMode();}catch(e){}
  showToast('Session orale terminée','ok');
}
function oralAbortSession(){
  if(ORAL_SESSION&&ORAL_SESSION.mode==='exam-blanc')clearExamBlancGlobalTimer();
  if(ORAL_SESSION&&ORAL_SESSION.timer){clearInterval(ORAL_SESSION.timer);ORAL_SESSION.timer=null;}
  ORAL_SESSION=null;
  oralCloseOv();
  try{renderOralMode();}catch(e){}
}
function oralRenderOv(){
  if(!ORAL_SESSION)return;
  const ov=ensureOralOv();
  const Sess=ORAL_SESSION;
  const q=Sess.queue[Sess.qIndex];
  const nq=Sess.queue.length;
  const totPts=q.points.length;
  const examBanner=Sess.mode==='exam-blanc'
    ?`<div style="text-align:center;margin-bottom:10px;font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--warn)">Examen blanc · <span id="oral-exam-global-timer">45:00</span></div>`
    :'';
  if(Sess.phase===1){
    ov.innerHTML=`<div class="oral-ov-scroll">
${examBanner}
<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0 8px;width:100%;max-width:440px;margin:0 auto">
  <button type="button" onclick="oralAbortSession()" style="color:var(--t3);font-size:13px;background:none;border:none;cursor:pointer">← Quitter</button>
  <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--t3)">${Sess.qIndex+1} / ${nq}</span>
</div>
<div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:var(--t1);line-height:1.35;margin-bottom:12px;max-width:440px;margin-left:auto;margin-right:auto">${escapeHtml(q.q)}</div>
<div style="font-size:11px;color:var(--t3);margin-bottom:16px;max-width:440px;margin-left:auto;margin-right:auto">${q.articles.map(escapeHtml).join(' · ')}</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:42px;font-weight:700;color:var(--accent-l);text-align:center;margin-bottom:8px" id="oral-chrono">${Sess.tRemaining}</div>
<div style="font-size:11px;color:var(--t3);text-align:center;margin-bottom:20px">secondes · préparation orale</div>
<button type="button" class="btn-main" style="max-width:440px;width:100%;margin:0 auto;display:block" onclick="oralReady()">Prêt — Voir les attendus</button>
</div>`;
    if(Sess.mode==='exam-blanc')examBlancUpdateGlobalTimerDisplay();
    return;
  }
  if(Sess.phase===2){
    const pi=Sess.pointIdx;
    ov.innerHTML=`<div class="oral-ov-scroll">
${examBanner}
<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0 8px;max-width:440px;margin:0 auto;width:100%">
  <button type="button" onclick="oralAbortSession()" style="color:var(--t3);font-size:13px;background:none;border:none;cursor:pointer">← Quitter</button>
  <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--t3)">Point ${pi+1} / ${totPts}</span>
</div>
<div style="font-size:12px;color:var(--gold);margin-bottom:8px;max-width:440px;margin-left:auto;margin-right:auto">Attendu jury</div>
<div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--t1);line-height:1.4;margin-bottom:20px;max-width:440px;margin-left:auto;margin-right:auto">${escapeHtml(q.points[pi])}</div>
<div style="display:flex;flex-direction:column;gap:10px;max-width:440px;margin:0 auto;width:100%">
  <button type="button" class="btn-main" onclick="oralPointAnswer(true)">Je savais</button>
  <button type="button" class="btn-ghost" onclick="oralPointAnswer(false)">Je ne savais pas</button>
</div>
</div>`;
    if(Sess.mode==='exam-blanc')examBlancUpdateGlobalTimerDisplay();
    return;
  }
  const xpQ=Sess.known*10;
  const hideXp=!!Sess.skipGamification;
  ov.innerHTML=`<div class="oral-ov-scroll">
${Sess.mode==='exam-blanc'?examBanner:''}
<div style="text-align:center;padding:16px 0 8px">
  <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:900;color:var(--t1)">Question ${Sess.qIndex+1} / ${nq}</div>
  <div style="font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--t2);margin-top:8px">Points validés : ${Sess.known} / ${totPts}</div>
  ${hideXp?'':`<div style="font-family:'JetBrains Mono',monospace;font-size:18px;color:var(--gold);margin-top:10px">+${xpQ} XP <span style="font-size:12px;color:var(--t3)">(10 XP / point « su »)</span></div>
  <div style="font-size:12px;color:var(--t3);margin-top:14px">Session cumulée : <strong style="color:var(--t1)">${Sess.sessionXP} XP</strong></div>`}
</div>
<div style="display:flex;flex-direction:column;gap:10px;max-width:440px;margin:20px auto 0;width:100%">
  ${Sess.qIndex+1<nq?`<button type="button" class="btn-main" onclick="oralNextQuestion()">Question suivante</button>`:''}
  <button type="button" class="${Sess.qIndex+1<nq?'btn-ghost':'btn-main'}" onclick="oralFinishSession()">${Sess.qIndex+1<nq?'Terminer la session':'Terminer'}</button>
</div>
</div>`;
  if(Sess.mode==='exam-blanc')examBlancUpdateGlobalTimerDisplay();
}
function escapeHtml(s){return eh(s);}
function updateDueCount(){
  const due=QB.filter(q=>FSRS.isDue(S.qcm.cards[q.id])).length;
  const el=document.getElementById('rev-due-count');
  if(el)el.textContent=due>0?due+' question'+(due>1?'s':'')+' à réviser maintenant':'Tout est à jour ✅';
  /* Badge nav-revision */
  const badge=document.getElementById('nav-revision-badge');
  if(badge){
    if(due>0){badge.textContent=due>99?'99+':String(due);badge.style.display='flex';}
    else{badge.textContent='';badge.style.display='none';}
  }
  /* Sync stats hero si visibles */
  const setV=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setV('qs-due',due||'0');
  setV('qs-total',QB.length||'—');
  const seenQ=QB.filter(q=>(S.qcm.cards[q.id]?.reps||0)>0).length;
  const okQ=QB.filter(q=>(S.qcm.cards[q.id]?.ok||0)>0).length;
  setV('qs-acc',seenQ>0?Math.round(okQ/seenQ*100)+'%':'—');
  const mastered=QB.filter(q=>{
    const c=S.qcm.cards[q.id];
    return c&&c.reps>=1&&!FSRS.isDue(c);
  }).length;
  setV('qs-master',String(mastered));
}
function renderRevThemes(){
  const THEMES=[
    {cat:'GAV',name:'Garde à Vue',em:'🔒',color:'#3b82f6'},
    {cat:'FLAGRANCE',name:'Flagrance',em:'🚨',color:'#ef4444'},
    {cat:'PERQUIZ',name:'Perquisitions',em:'🔍',color:'#8b5cf6'},
    {cat:'AUDLIB',name:'Audition Libre',em:'🎙️',color:'#10b981'},
    {cat:'MANDATS',name:'Mandats',em:'📋',color:'#f59e0b'},
    {cat:'MINEURS',name:'Mineurs',em:'👶',color:'#ec4899'},
    {cat:'OPJ',name:'Statut OPJ',em:'⚖️',color:'#d4af37'},
    {cat:'PRESCRIP',name:'Prescription',em:'⏳',color:'#6366f1'},
    {cat:'RECIDIVE',name:'Récidive',em:'🔄',color:'#f97316'},
    {cat:'LEGDEF',name:'Légitime Défense',em:'🛡️',color:'#14b8a6'},
    {cat:'NULLITES',name:'Nullités',em:'🚫',color:'#64748b'},
    {cat:'INSTRUCTION',name:'Instruction',em:'🏛️',color:'#0ea5e9'},
    {cat:'INFRACTIONS',name:'Infractions',em:'⚡',color:'#e11d48'},
    {cat:'LIBERTES',name:'Libertés',em:'🏛️',color:'#14b8a6'},
    {cat:'CDO',name:'Criminalité Org.',em:'🕵️',color:'#a855f7'},
    {cat:'COMMISSION',name:'Commission Rogatoire',em:'📄',color:'#22d3ee'},
    {cat:'ALTERNATIVES',name:'Alternatives AP',em:'🤝',color:'#22c55e'},
    {cat:'TAJ',name:'Fichiers Police',em:'🗃️',color:'#a855f7'},
    {cat:'ACTION_PUB',name:'Action Publique',em:'⚖️',color:'#64748b'},
    {cat:'CONTROLES',name:'Contrôles ID',em:'🪪',color:'#0ea5e9'},
    {cat:'MESURES_COERC',name:'Mesures Coercitives',em:'⛓️',color:'#8b5cf6'},
    {cat:'FICHIERS',name:'Fichiers',em:'💾',color:'#6366f1'},
    {cat:'ENQUETES_SPEC',name:'Enquêtes Spéciales',em:'🔬',color:'#ec4899'},
    {cat:'PATRIMONIAL',name:'Patrimonial',em:'💰',color:'#f59e0b'},
    {cat:'REQS',name:'Réquisitions',em:'📨',color:'#0891b2'},
    {cat:'EUROP',name:'Coopération UE',em:'🌍',color:'#2563eb'},
    {cat:'PROBATION',name:'Probation & Peines',em:'⚖️',color:'#9333ea'},
    {cat:'CYBER',name:'Cybercriminalité',em:'💻',color:'#06b6d4'},
    {cat:'VIOLENCES_CONJ',name:'Violences Conjugales',em:'🛡️',color:'#e11d48'},
    {cat:'STUPS',name:'Stupéfiants',em:'💊',color:'#84cc16'},
    {cat:'ATTEINTES_LIBERTE',name:'Atteintes Libertés',em:'⚠️',color:'#f97316'},
    {cat:'INFRACTIONS_PUB',name:'Infractions Publiques',em:'📢',color:'#8b5cf6'},
    {cat:'CRIMORG',name:'Criminalité Organisée',em:'🕵️',color:'#7c3aed'},
  ];
  const el=document.getElementById('theme-list');if(!el)return;

  /* Mise à jour stats QCM hero */
  const totalQ=QB.length;
  const dueQ=QB.filter(q=>FSRS.isDue(S.qcm.cards[q.id])).length;
  const seenQ=QB.filter(q=>(S.qcm.cards[q.id]?.reps||0)>0).length;
  const okQ=QB.filter(q=>(S.qcm.cards[q.id]?.ok||0)>0).length;
  const accPct=seenQ>0?Math.round(okQ/seenQ*100):0;
  const setV=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setV('qs-due',dueQ||'0');
  setV('qs-total',totalQ||'—');
  setV('qs-acc',seenQ>0?accPct+'%':'—');
  const mastered=QB.filter(q=>{
    const c=S.qcm.cards[q.id];
    return c&&c.reps>=1&&!FSRS.isDue(c);
  }).length;
  setV('qs-master',String(mastered));
  setV('rev-due-count',dueQ>0?`${dueQ} question${dueQ>1?'s':''} à réviser maintenant`:'Tout est à jour ✅');

  const themes=THEMES.filter(t=>QB.some(q=>q.cat===t.cat));
  const thCount=document.getElementById('qcm-themes-count');
  if(thCount)thCount.textContent=themes.length+' thèmes';
  const rmcR=document.getElementById('rmc-stat-reviser');
  if(rmcR)rmcR.textContent=themes.length+' th. · '+totalQ;

  renderSkeletons('theme-list',6,72);
  clearTimeout(window._skRevThemes);
  window._skRevThemes=setTimeout(()=>{
    const el2=document.getElementById('theme-list');if(!el2)return;
    el2.innerHTML=themes.map((t,i)=>{
    const pool=QB.filter(q=>q.cat===t.cat);
    const done=pool.filter(q=>(S.qcm.cards[q.id]?.reps||0)>0).length;
    const ok=pool.filter(q=>(S.qcm.cards[q.id]?.ok||0)>0).length;
    const due=pool.filter(q=>FSRS.isDue(S.qcm.cards[q.id])).length;
    const pctDone=Math.round(done/pool.length*100);
    const pctOk=done>0?Math.round(ok/done*100):0;
    const completed=done===pool.length&&pool.length>0;
    return`<div onclick="startSession('${t.cat}')" class="theme-card" style="
  --tc:${t.color};
  animation:fadeUp .15s ${i*0.025}s both;
">
  <div class="theme-card-ico" style="background:${t.color}15;border-color:${t.color}35">${t.em}</div>
  <div style="flex:1;min-width:0;overflow:hidden;">
    <div style="font-size:13px;font-weight:700;color:var(--t1);
      margin-bottom:3px;white-space:nowrap;overflow:hidden;
      text-overflow:ellipsis;">${t.name}</div>
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;flex-wrap:wrap;">
      <span style="font-size:9px;color:var(--t3);font-family:'JetBrains Mono',monospace;">
        ${pool.length} questions
      </span>
      ${due>0?`<span style="font-size:9px;font-weight:700;color:var(--warn);background:var(--warn-bg);border:1px solid rgba(255,140,66,.25);border-radius:4px;padding:1px 5px;font-family:'JetBrains Mono',monospace;">⚡ ${due}</span>`:''}
      ${completed?`<span style="font-size:9px;font-weight:700;color:var(--ok);background:var(--ok-bg);border:1px solid rgba(0,201,122,.25);border-radius:4px;padding:1px 5px;">✓</span>`:''}
    </div>
    <div style="height:3px;background:var(--bg-3);border-radius:100px;overflow:hidden;">
      <div style="height:100%;width:${pctDone}%;background:${t.color};border-radius:100px;opacity:.85;"></div>
    </div>
  </div>
  <div style="flex-shrink:0;text-align:right;width:36px;padding-right:4px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:900;color:${t.color};">
      ${completed?'✓':pctDone+'%'}
    </div>
  </div>
</div>`;
  }).join('');
  },150);
}

function renderDueFlashWrap(){
  const wrap=document.getElementById('fiches-due-wrap');
  if(!wrap)return;
  const due=typeof FSRS!=='undefined'&&FSRS.getDueFlashcards?FSRS.getDueFlashcards(S.flashFsrs):[];
  if(!due.length){wrap.innerHTML='';return;}
  const n=due.length;
  wrap.innerHTML=`<button type="button" class="btn btn-p btn-full" style="margin-top:8px;font-size:13px;font-weight:700" onclick="startDueSession()">🎯 ${n} fiche${n>1?'s':''} à réviser aujourd’hui</button>`;
}

let _activeFam=null;

function renderBubbles(){
  const grid=document.getElementById('bubble-grid');if(!grid)return;
  renderDueFlashWrap();
  grid.style.cssText='display:block;width:100%;box-sizing:border-box;padding:0;';
  const search=(document.getElementById('fiches-search')?.value||'').toLowerCase();

  const FAMILIES={
    vie:      {label:'Vie',           em:'💀',color:'#ef4444',grad:'linear-gradient(135deg,#ef4444,#dc2626)'},
    integrite:{label:'Intégrité',     em:'🩸',color:'#f97316',grad:'linear-gradient(135deg,#f97316,#ea580c)'},
    biens:    {label:'Biens',         em:'💰',color:'#f59e0b',grad:'linear-gradient(135deg,#f59e0b,#d97706)'},
    autorite: {label:'Autorité',      em:'🛡️',color:'#3b82f6',grad:'linear-gradient(135deg,#3b82f6,#2563eb)'},
    stups:    {label:'Stupéfiants',   em:'💊',color:'#a855f7',grad:'linear-gradient(135deg,#a855f7,#9333ea)'},
    route:    {label:'Route',         em:'🚗',color:'#10b981',grad:'linear-gradient(135deg,#10b981,#059669)'},
  };

  const mastered=FB.filter(f=>S.fs[f.id]==='m').length;
  const learning=FB.filter(f=>S.fs[f.id]==='s').length;
  const pct=FB.length>0?Math.round(mastered/FB.length*100):0;
  const elSum=document.getElementById('fiches-summary');
  if(elSum)elSum.textContent=`${mastered}/${FB.length} maîtrisées · ${learning} en cours`;
  const rmcF=document.getElementById('rmc-stat-fiches');
  if(rmcF)rmcF.textContent=mastered+'/'+FB.length;
  const pb=document.getElementById('fiches-prog-bar');
  if(pb)pb.style.width=pct+'%';

  const filtered=search
    ?FB.filter(f=>f.nm.toLowerCase().includes(search)||(f.ref||'').toLowerCase().includes(search))
    :FB;

  if(!filtered.length){
    grid.innerHTML=`<div class="empty-state"><span class="empty-state-em">🔍</span>Aucune fiche pour "${eh(search)}"</div>`;
    renderDueFlashWrap();
    return;
  }

  renderSkeletons('bubble-grid',8,96,{tile:true,width:80});
  clearTimeout(window._skBub);
  window._skBub=setTimeout(()=>{
    const gridEl=document.getElementById('bubble-grid');if(!gridEl)return;
  /* Noms courts pour tiles */
  const shortNm=nm=>{
    const map={
      'MEURTRE':'Meurtre','HOMICIDE INVOLONTAIRE':'Homicide inv.','VIOLENCES VOLONTAIRES':'Violences vol.',
      'VIOL':'Viol','VOL':'Vol','ESCROQUERIE':'Escroquerie','ABUS DE CONFIANCE':'Abus confiance',
      'RECEL':'Recel','OUTRAGE':'Outrage','RÉBELLION':'Rébellion','USAGE STUPÉFIANTS':'Usage stups',
      'CONDUITE ALCOOLIQUE':'Conduite alcool','EXTORSION':'Extorsion','TRAFIC STUPÉFIANTS':'Trafic stups',
      'CORRUPTION PASSIVE':'Corruption',
      'AGRESSION SEXUELLE':'Agress. sex.','VIOLENCE CONJUGALE':'Violence conj.','NON-ASSISTANCE':'Non-assistance',
      'ASSASSINAT':'Assassinat','SÉQUESTRATION':'Séquestration','TRAITE DES ÊTRES':'Traite êtres',
      'ABUS DE FAIBLESSE':'Abus faiblesse','DÉLAISSEMENT':'Délaissement','FAUX ET USAGE':'Faux et usage',
      'BLANCHIMENT':'Blanchiment','PROXÉNÉTISME':'Proxénétisme','CORRUPTION ACTIVE':'Corrupt. active',
      'PRISE ILLÉGALE':'Prise illégale','DÉTOURNEMENT':'Détournement','ADMINISTRATION DE SUBSTANCE':'Admin. substance',
    };
    return map[nm]||(nm.length>16?nm.slice(0,15)+'…':nm);
  };

  /* Tile individuelle */
  const tile=(f,i,fam)=>{
    const st=S.fs[f.id]||'';
    const color=fam?.color||'#3b82f6';
    const grad=fam?.grad||`linear-gradient(135deg,${color},${color})`;
    const isMastered=st==='m', isLearning=st==='s';
    return`<div class="ft${isMastered?' ft-m':isLearning?' ft-s':''}"
      onclick="openFiche('${f.id}')"
      style="animation:popIn .2s ${i*0.04}s both;--ftc:${color};--ftg:${grad}"
      role="button" tabindex="0">
      <div class="ft-top">
        ${isMastered?`<div class="ft-crown">★</div>`
          :isLearning?`<div class="ft-dot"></div>`
          :`<div class="ft-lock"></div>`}
      </div>
      <div class="ft-em" style="font-size:28px;margin-bottom:2px">${eh(f.em)}</div>
      <div class="ft-nm">${eh(shortNm(f.nm))}</div>
      <div class="ft-qual" style="font-size:9px;font-family:'JetBrains Mono',monospace;font-weight:700;padding:2px 7px;border-radius:8px;background:${fam?.color?fam.color+'22':'rgba(99,102,241,0.15)'};color:${fam?.color||'var(--accent)'};margin-top:3px;flex-shrink:0;white-space:nowrap">${eh(f.qual)}</div>
    </div>`;
  };

  /* Mode recherche → grille plate */
  if(search){
    gridEl.innerHTML=`<div class="ft-grid">${filtered.map((f,i)=>tile(f,i,FAMILIES[f.fam])).join('')}</div>`;
    renderDueFlashWrap();
    return;
  }

  /* ── Niveau 1 : rangée de bulles catégories (drill-down) ── */
  const famKeys=Object.keys(FAMILIES).filter(k=>filtered.some(f=>f.fam===k));
  if(!famKeys.length){
    gridEl.innerHTML=`<div class="empty-state"><span class="empty-state-em">🔍</span>Aucune fiche</div>`;
    renderDueFlashWrap();
    return;
  }
  if(_activeFam&&!famKeys.includes(_activeFam))_activeFam=null;
  let bubblesHtml=`<div class="fam-bubbles" id="fam-bubbles-row">`;
  famKeys.forEach(key=>{
    const fam=FAMILIES[key];
    const items=filtered.filter(f=>f.fam===key);
    const mastered=items.filter(f=>S.fs[f.id]==='m').length;
    const isActive=_activeFam===key||(!_activeFam&&key===famKeys[0]);
    bubblesHtml+=`
  <div class="fam-bubble${isActive?' active':''}"
       style="--fc:${fam.color}"
       onclick="selectFamBubble('${key}')"
       role="button" tabindex="0">
    <div class="fam-bubble-ico">${fam.em}</div>
    <div class="fam-bubble-label">${eh(fam.label)}</div>
    <div class="fam-bubble-cnt">${mastered}/${items.length}</div>
  </div>`;
  });
  bubblesHtml+=`</div>`;
  if(!_activeFam)_activeFam=famKeys[0];
  const activeFam=FAMILIES[_activeFam];
  const activeItems=filtered.filter(f=>f.fam===_activeFam);
  const gridHtml=`<div class="ft-grid" id="fam-active-grid">
  ${activeItems.map((f,i)=>tile(f,i,activeFam)).join('')}
</div>`;
  gridEl.innerHTML=bubblesHtml+gridHtml;
  renderDueFlashWrap();
  },150);
}

function selectFamBubble(key){
  _activeFam=key;
  renderBubbles();
  setTimeout(()=>{
    document.getElementById('fam-active-grid')
      ?.scrollIntoView({behavior:'smooth',block:'nearest'});
  },200);
}
window.selectFamBubble=selectFamBubble;

function openFiche(id){
  const f=FB.find(x=>x.id===id);if(!f)return;
  S._ficheOpenId=id;
  if(S.fsDueSession?.ids?.length&&!S.fsDueSession.ids.includes(id)){
    S.fsDueSession=null;
    try{save();}catch(e){}
  }
  /* FIX v49 — déplacer fiche-ov hors de p-revision (display:none) vers #app */
  (function ensureGlobal(){
    const ov=document.getElementById('fiche-ov');
    const app=document.getElementById('app');
    if(!ov||!app)return;
    if(ov.parentNode&&ov.parentNode!==app&&ov.parentNode!==document.body){
      app.appendChild(ov);
    }
  })();
  const st=S.fs[id]||'';
  const QUAL_COLORS={
    'Crime':       {h:'#ef4444',bg:'rgba(239,68,68,.1)',grd:'linear-gradient(135deg,rgba(239,68,68,.15),rgba(239,68,68,.04))'},
    'Délit':       {h:'#3b82f6',bg:'rgba(37,99,235,.1)', grd:'linear-gradient(135deg,rgba(37,99,235,.12),rgba(37,99,235,.04))'},
    'Variable':    {h:'#f59e0b',bg:'rgba(245,158,11,.1)',grd:'linear-gradient(135deg,rgba(245,158,11,.12),rgba(245,158,11,.04))'},
    'Crime/Délit': {h:'#a855f7',bg:'rgba(168,85,247,.1)',grd:'linear-gradient(135deg,rgba(168,85,247,.12),rgba(168,85,247,.04))'},
  };
  const qc=QUAL_COLORS[f.qual]||QUAL_COLORS['Délit'];
  const statuses=[
    {s:'',   lbl:'Non vue',    icon:'○', bg:'var(--bg-3)',     c:'var(--t3)'},
    {s:'s',  lbl:'Vue ✓',      icon:'◐', bg:'rgba(37,99,235,.12)', c:'#3b82f6'},
    {s:'m',  lbl:'Maîtrisée ★',icon:'★', bg:'rgba(212,175,55,.12)','c':'var(--gold)'},
  ];

  let h=`
  <!-- HEADER -->
  <div class="fo-header" style="background:${qc.grd};border-bottom:1px solid ${qc.h}22">
    <div class="fo-header-top">
      <div class="fo-em">${eh(f.em)}</div>
      <div class="fo-header-right">
        <span class="fo-qual-badge" style="background:${qc.bg};color:${qc.h}">${eh(f.qual)}</span>
        <span class="fo-fam-badge">${eh(f.fam||'—')}</span>
      </div>
    </div>
    <div class="fo-title">${eh(f.nm)}</div>
    <div class="fo-ref">${eh(f.ref)}</div>
    <div class="fo-pn">
      <span class="fo-pn-icon">⚖️</span>
      <span class="fo-pn-txt">${eh(f.pn)}</span>
    </div>
  </div>

  <!-- STATUS SÉLECTEUR -->
  <div class="fo-status-row">
    ${statuses.map(b=>`
      <button class="fo-status-btn${st===b.s?' active':''}"
        onclick="setFiche('${id}','${b.s}')"
        style="${st===b.s?`background:${b.bg};color:${b.c};border-color:${b.c}`:''}">
        <span class="fo-status-icon">${b.icon}</span>
        <span class="fo-status-lbl">${b.lbl}</span>
      </button>`).join('')}
  </div>
  <div class="fiche-next-review" id="fiche-next-review-label"></div>

  <!-- ÉLÉMENTS CONSTITUTIFS -->
  <div class="fo-section">
    <div class="fo-section-hd">📐 Éléments constitutifs</div>
    ${f.L?`<div class="fo-block fo-block-legal">
      <div class="fo-block-label">📜 LÉGAL</div>
      <div class="fo-block-text">${eh(f.L)}</div>
    </div>`:''}
    ${f.A?`<div class="fo-block fo-block-materiel">
      <div class="fo-block-label">🔨 MATÉRIEL</div>
      <div class="fo-block-text">${eh(f.A)}</div>
    </div>`:''}
    ${f.M?`<div class="fo-block fo-block-moral">
      <div class="fo-block-label">🧠 MORAL</div>
      <div class="fo-block-text">${eh(f.M)}</div>
    </div>`:''}
  </div>`;

  /* AGGRAVANTES */
  const aggs=(f.E||[]).filter(e=>e.a&&e.a!=='—');
  if(aggs.length){
    h+=`<div class="fo-section">
      <div class="fo-section-hd">⬆️ Circonstances aggravantes</div>
      <div class="fo-agg-table">
        ${aggs.map(e=>`
          <div class="fo-agg-row">
            <div class="fo-agg-left">
              <div class="fo-agg-nm">${eh(e.a)}</div>
              ${e.r?`<div class="fo-agg-ref">Art. ${eh(e.r)}</div>`:''}
            </div>
            <div class="fo-agg-pn" style="background:rgba(239,68,68,.12);color:#ef4444">${eh(e.p)}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  /* NE PAS CONFONDRE */
  if(f.cf){
    const cfTxt=typeof f.cf==='string'?f.cf:((f.cf.av||'')+' '+(f.cf.cr||'')).trim();
    h+=`<div class="fo-section">
      <div class="fo-section-hd">🔀 Ne pas confondre</div>
      <div class="fo-cf-card">
        <div class="fo-cf-text">${eh(cfTxt)}</div>
      </div>
    </div>`;
  }

  /* PIÈGE D'EXAMEN */
  if(f.pg){
    h+=`<div class="fo-piege">
      <div class="fo-piege-hd">⚠️ Piège d'examen</div>
      <div class="fo-piege-txt">${eh(f.pg)}</div>
    </div>`;
  }

  let dueFoot='';
  if(S.fsDueSession?.ids?.length){
    const ix=S.fsDueSession.ids.indexOf(id);
    if(ix>=0){
      const tot=S.fsDueSession.ids.length,pos=ix+1;
      dueFoot=`<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;width:100%">
        <button type="button" class="btn btn-p btn-full" onclick="nextDueFiche()">Fiche suivante (${pos}/${tot})</button>
        <button type="button" class="btn btn-ghost btn-full" onclick="endDueFicheSession(false)">Terminer la session</button>
      </div>`;
    }
  }
  h+=dueFoot+`<button class="btn btn-ghost btn-full" style="margin-top:16px" onclick="closeFiche()">Fermer</button>`;

  const _fb=document.getElementById('fiche-body');if(_fb)_fb.innerHTML=h;
  const _fnr=document.getElementById('fiche-next-review-label');
  if(_fnr)_fnr.textContent=ficheNextReviewLabel(id);
  const _fo=document.getElementById('fiche-ov');if(_fo)_fo.style.display='flex';
  document.body.style.overflow='hidden';
}

function closeFiche(){
  const ov=document.getElementById('fiche-ov');
  if(ov){ov.style.display='none';ov.style.alignItems='flex-end';}
  document.body.style.overflow='';
}
function ficheNextReviewLabel(ficheId) {
  const card = S.flashFsrs?.[ficheId];
  const nextReview = card?.nextReview ?? card?.due;
  if (nextReview == null) return '';
  const days = Math.ceil(
    (new Date(nextReview) - Date.now()) / 86400000
  );
  if (days <= 0) return 'Reproposée aujourd\'hui';
  if (days === 1) return 'Prochaine révision demain';
  return `Prochaine révision dans ${days} jour${days > 1 ? 's' : ''}`;
}
function setFiche(id,s){
  const p=S.fs[id];
  if(s==='m'&&p!=='m'&&!S._jjRevision){addXP(15);showToast('+15 XP — Fiche maîtrisée !','ok');}
  S.fs[id]=s;
  if(typeof FSRS!=='undefined'&&FSRS.reviewFlashcard){
    if(s==='m')FSRS.reviewFlashcard(id,true);
    else if(s==='s')FSRS.reviewFlashcard(id,false);
  }
  save();openFiche(id);renderBubbles();
  const label = ficheNextReviewLabel(id);
  const el = document.getElementById('fiche-next-review-label');
  if (el) el.textContent = label;
}

/* ─── ADAPTIVE DIFFICULTY ─── */
function getUserLevel(){
  const xp=S.user.xp||0;
  if(xp<200)return 1;
  if(xp<1000)return 2;
  return 3;
}

function _adaptiveSort(questions){
  const lvl=getUserLevel();
  const weights={1:{1:70,2:30,3:0},2:{1:30,2:50,3:20},3:{1:0,2:20,3:80}};
  const w=weights[lvl];
  return [...questions].sort((a,b)=>{
    const wa=w[a.diff]||10;
    const wb=w[b.diff]||10;
    return wb-wa||(Math.random()-.5);
  });
}

/* ─── QCM ENGINE ─── */
let _examTimer=null;
function startSmartSession(){
  try{AudioFX.click();}catch(e){}
  S.qcm.sessionKind='smart';
  const ps=S.placementDone&&S.placementScore?S.placementScore:{};
  const hasPlacement=Object.keys(ps).length>0;
  const due=QB.filter(q=>FSRS.isDue(S.qcm.cards[q.id]));
  let base=due.length>=10?due:[...QB].sort(()=>Math.random()-.5).slice(0,20);
  if(hasPlacement){
    const weakCats=Object.entries(ps).filter(([,v])=>v<50).map(([k])=>k);
    if(weakCats.length){
      const weakQ=base.filter(q=>weakCats.includes(q.cat));
      const otherQ=base.filter(q=>!weakCats.includes(q.cat));
      base=[...weakQ,...otherQ];
    }
  }
  const pool=_adaptiveSort(base);
  buildSession(pool.slice(0,10));
}
function startSession(cat){
  S.qcm.sessionKind='theme';
  const pool=QB.filter(q=>q.cat===cat);
  if(!pool.length){showToast('Aucune question pour ce thème','err');return;}
  buildSession(pool.sort(()=>Math.random()-.5).slice(0,Math.min(10,pool.length)));
}
function startFlashSession(){
  S.qcm.sessionKind='flash';
  const due=QB.filter(q=>FSRS.isDue(S.qcm.cards[q.id]));
  const pool=due.length>=5?due:QB;
  buildSession(pool.sort(()=>Math.random()-.5).slice(0,5));
}
function startExamSession(n,minutes){
  S.qcm.sessionKind='exam';
  const pool=[...QB].sort(()=>Math.random()-.5).slice(0,Math.min(n,QB.length));
  buildSession(pool,minutes);
}

/* ═══ FLASH EXPRESS — 3 questions faibles, 2 min ═══ */
function startFlashExpress(){
  try{AudioFX.click();}catch(e){}
  S.qcm.sessionKind='flash';
  const catStats={};
  QB.forEach(q=>{
    const card=S.qcm.cards[q.id];
    if(!card||!card.reps)return;
    if(!catStats[q.cat])catStats[q.cat]={ok:0,total:0};
    catStats[q.cat].total++;
    if(card.ok)catStats[q.cat].ok+=card.ok;
  });
  let weakCats=Object.entries(catStats)
    .map(([cat,s])=>({cat,rate:s.total?s.ok/s.total:0}))
    .sort((a,b)=>a.rate-b.rate)
    .slice(0,3)
    .map(c=>c.cat);
  if(weakCats.length<3){
    const allCats=[...new Set(QB.map(q=>q.cat))];
    for(const c of allCats){
      if(!weakCats.includes(c))weakCats.push(c);
      if(weakCats.length>=3)break;
    }
  }
  const picked=[];
  weakCats.forEach(cat=>{
    const pool=QB.filter(q=>q.cat===cat);
    const due=pool.filter(q=>FSRS.isDue(S.qcm.cards[q.id]));
    const src=due.length?due:pool;
    const sorted=_adaptiveSort(src);
    const q=sorted[0];
    if(q)picked.push(q);
  });
  if(!picked.length){
    const fallback=[...QB].sort(()=>Math.random()-.5).slice(0,3);
    buildSession(fallback);
    return;
  }
  buildSession(picked);
}

/* ═══ TEST DE PLACEMENT — 10 questions, 5 thèmes ═══ */
function startPlacementTest(){
  if(S.placementDone){showToast('Déjà effectué','err');return;}
  S.qcm.sessionKind='placement';
  const themes=['GAV','FLAGRANCE','PERQUIZ','OPJ','INFRACTIONS'];
  const picked=[];
  themes.forEach(cat=>{
    const pool=QB.filter(q=>q.cat===cat&&(q.diff===1||q.diff===2));
    const fallback=pool.length?pool:QB.filter(q=>q.cat===cat);
    const shuffled=[...fallback].sort(()=>Math.random()-.5);
    picked.push(...shuffled.slice(0,2));
  });
  if(picked.length<5){
    const extra=[...QB].filter(q=>!picked.includes(q)).sort(()=>Math.random()-.5);
    while(picked.length<10&&extra.length)picked.push(extra.shift());
  }
  buildSession(picked.slice(0,10));
}

/* ═══ RÉVISION DES ERREURS — top 3 catégories faibles ═══ */
function startErrorReview(){
  if(!S.errorLog||!Object.keys(S.errorLog).length){
    showToast('Aucune erreur enregistrée','err');return;
  }
  S.qcm.sessionKind='errorReview';
  const sorted=Object.entries(S.errorLog).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const cats=sorted.map(e=>e[0]);
  const picked=[];
  cats.forEach(cat=>{
    const pool=QB.filter(q=>q.cat===cat);
    const due=pool.filter(q=>FSRS.isDue(S.qcm.cards[q.id]));
    const src=due.length?due:pool;
    const shuffled=[...src].sort(()=>Math.random()-.5);
    picked.push(...shuffled.slice(0,2));
  });
  if(picked.length<5){
    const extra=QB.filter(q=>cats.includes(q.cat)&&!picked.includes(q)).sort(()=>Math.random()-.5);
    while(picked.length<5&&extra.length)picked.push(extra.shift());
  }
  showToast('Révision ciblée : tes 3 points faibles','ok');
  buildSession(picked.slice(0,5));
}
function _beginSession(queue,minutes){
  S.qcm.queue=queue.map(q=>shuffleQ({...q}));S.qcm.idx=0;S.qcm.answered=null;S.qcm.stats={ok:0,ko:0,xp:0};
  S.qcm.wrongs=[];S.qcm.startedAt=Date.now();S.qcm.examMinutes=minutes||0;
  const _qs=document.getElementById('qcm-session');if(_qs)_qs.style.display='block';
  const _qr=document.getElementById('qcm-results');if(_qr)_qr.style.display='none';
  const _rm=document.getElementById('rev-menu');if(_rm)_rm.style.display='none';
  if(minutes>0)startExamBanner(minutes);
  renderCurrentQ();
  navigateTo('revision');
}

/* ─── v50 — Mélange des réponses QCM ─── */
function shuffleQ(q){
  /* Associer chaque option à son index original */
  const pairs=q.opts.map((opt,i)=>({opt,correct:i===q.c}));
  /* Fisher-Yates shuffle */
  for(let i=pairs.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [pairs[i],pairs[j]]=[pairs[j],pairs[i]];
  }
  return{...q, opts:pairs.map(p=>p.opt), c:pairs.findIndex(p=>p.correct)};
}

/* Shuffle déterministe (même graine = même résultat) pour QDJ */
function seededShuffle(arr, seed){
  const a=[...arr]; let s=seed;
  const rand=()=>{s=(s*9301+49297)%233280;return s/233280;};
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(rand()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function buildSession(pool,minutes=0){_beginSession(pool,minutes);}
function renderCurrentQ(){
  const q=S.qcm.queue[S.qcm.idx];if(!q)return;
  const tot=S.qcm.queue.length;
  const _progTxt=document.getElementById('qcm-prog-txt');
  if(_progTxt)_progTxt.textContent=(S.qcm.idx+1)+'/'+tot;
  const dots=Array.from({length:tot},(_,i)=>`<div class="q-dot ${i<S.qcm.idx?'done':i===S.qcm.idx?'cur':''}"></div>`).join('');
  const letters=['A','B','C','D'];
  const answered=S.qcm.answered;
  const isFirstEver=(S.user.sessionsDone||0)===0&&S.qcm.idx===0;
  let html=`<div class="q-progress">${dots}</div>`;
  html+=`<div class="q-cat">${eh(q.cat||'QCM')}</div>`;
  html+=`<div class="q-txt">${eh(q.q)}</div>`;
  html+=`<div class="q-art">${eh(q.art||'')}</div>`;
  html+=`<div class="q-opts">`;
  q.opts.forEach((opt,i)=>{
    let cls='q-opt';
    if(answered!==null){
      cls+=' disabled';
      if(i===q.c){cls+=' correct q-opt--animate-correct';}
      else if(i===answered&&answered!==q.c){cls+=' wrong q-opt--animate-wrong';}
    }
    html+=`<button class="${cls}" onclick="answerQ(${i})"><span class="q-letter">${letters[i]}</span>${eh(opt)}</button>`;
  });
  html+=`</div>`;
  if(isFirstEver){html+=`<div class="swipe-hint" id="swipe-hint-el"><span>← Swiper pour passer après avoir répondu</span></div>`;}
  if(answered!==null&&q.expl){
    const ok=answered===q.c;
    html+=`<div class="q-expl"><div class="q-verdict ${ok?'ok':'ko'}">${ok?'✓ Correct !':'✗ Incorrect'}</div>${eh(q.expl)}</div>`;
  }
  const _qb=document.getElementById('qcm-body');if(_qb)_qb.innerHTML=html;
  const nw=document.getElementById('qcm-next-wrap');
  if(nw)nw.style.display=answered!==null?'block':'none';
  /* ── Swipe gauche = question suivante ── */
  const qBody=document.getElementById('qcm-body');
  if(qBody){
    const freshBody=qBody.cloneNode(true);
    qBody.parentNode.replaceChild(freshBody,qBody);
    let _tsX=0,_tsY=0;
    freshBody.addEventListener('touchstart',e=>{
      _tsX=e.touches[0].clientX;
      _tsY=e.touches[0].clientY;
    },{passive:true});
    freshBody.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-_tsX;
      const dy=Math.abs(e.changedTouches[0].clientY-_tsY);
      if(dx<-60&&dy<40&&S.qcm.answered!==null){nextQuestion();}
    },{passive:true});
  }
}
function answerQ(i){
  const q=S.qcm.queue[S.qcm.idx];if(!q||S.qcm.answered!==null)return;
  S.qcm.answered=i;
  const correct=i===q.c;
  try {
    if (correct) {
      if (typeof AudioFX !== 'undefined' && AudioFX.correct) AudioFX.correct();
    } else {
      if (typeof AudioFX !== 'undefined' && AudioFX.wrong) AudioFX.wrong();
    }
  } catch(e) {}
  if(!S.qcm.cards[q.id])S.qcm.cards[q.id]=FSRS.newCard();
  S.qcm.cards[q.id]=FSRS.review(S.qcm.cards[q.id],correct);
  if(correct){const xp=10+(q.diff||1)*5;S.qcm.stats.ok++;S.qcm.stats.xp+=xp;addXP(xp);haptic(40);}
  else{
    S.qcm.stats.ko++;
    if(!S.qcm.wrongs)S.qcm.wrongs=[];
    S.qcm.wrongs.push(q);
    if(!S.errorLog)S.errorLog={};
    if(!S.errorLog[q.cat])S.errorLog[q.cat]=0;
    S.errorLog[q.cat]++;
    haptic([40,80,40]);
  }
  save();renderCurrentQ();
}
function nextQuestion(){
  S.qcm.idx++;S.qcm.answered=null;
  if(S.qcm.idx>=S.qcm.queue.length)finishSession();
  else renderCurrentQ();
}
function finishSession(){
  const _xpFin=(S.qcm&&S.qcm.stats&&S.qcm.stats.xp)||0;
  if(_xpFin>0)showXPPop(_xpFin);
  stopExamBanner();S.user.sessionsDone++;save();
  const tot=S.qcm.queue.length;
  const ok=S.qcm.stats.ok;
  const xpGain=S.qcm.stats.xp||0;
  const ex=S.qcm.examMinutes||0;
  const q0=S.qcm.queue[0];
  const sk=S.qcm.sessionKind||'smart';
  if(sk==='exam'){
    S.qcm.lastReplay={kind:'exam',n:Math.min(tot,QB.length),min:ex};
  }else if(sk==='flash'){
    S.qcm.lastReplay={kind:'flash'};
  }else if(sk==='theme'&&q0){
    S.qcm.lastReplay={kind:'theme',cat:q0.cat};
  }else{
    S.qcm.lastReplay={kind:'smart'};
  }
  if(sk==='placement'){
    const catScores={};
    S.qcm.queue.forEach(q=>{
      if(!catScores[q.cat])catScores[q.cat]={ok:0,total:0};
      catScores[q.cat].total++;
    });
    (S.qcm.wrongs||[]).forEach(q=>{
      if(catScores[q.cat])catScores[q.cat].ok--;
    });
    const scores={};
    Object.entries(catScores).forEach(([cat,s])=>{
      const okCount=s.total-(S.qcm.wrongs||[]).filter(q=>q.cat===cat).length;
      scores[cat]=Math.round(Math.max(0,okCount)/s.total*100);
    });
    S.placementDone=true;
    S.placementScore=scores;
    save();
    const overall=Math.round(ok/tot*100);
    showToast('Test de niveau : '+overall+'% — Parcours personnalisé !','ok');
  }
  const _qs2=document.getElementById('qcm-session');if(_qs2)_qs2.style.display='none';
  const _qr2=document.getElementById('qcm-results');if(_qr2)_qr2.style.display='block';
  const tierEl=document.getElementById('qr-tier');
  const scoreEl=document.getElementById('qr-score-big');
  const msgEl=document.getElementById('qr-msg');
  const statsEl=document.getElementById('qr-stats-compact');
  const errEl=document.getElementById('qr-errors');
  const xpEl=document.getElementById('qr-xp-anim');
  if(scoreEl)scoreEl.textContent=ok+'/'+tot;
  let tier='red',msg='Continue, tu progresses !';
  if(tot>=10){
    if(ok>=8){tier='green';msg='Excellent ! Tu maîtrises !';}
    else if(ok>=5){tier='orange';msg='Bon travail, encore un effort !';}
    else{tier='red';msg='Continue, tu progresses !';}
  }else{
    const p=tot?ok/tot:0;
    if(p>=0.8){tier='green';msg='Excellent ! Tu maîtrises !';}
    else if(p>=0.5){tier='orange';msg='Bon travail, encore un effort !';}
    else{tier='red';msg='Continue, tu progresses !';}
  }
  if(tierEl){
    tierEl.className='qr-tier qr-tier--'+tier;
  }
  if(msgEl)msgEl.textContent=msg;
  let timeStr='—';
  if(S.qcm.startedAt){
    const sec=Math.max(0,Math.floor((Date.now()-S.qcm.startedAt)/1000));
    const m=Math.floor(sec/60),s=sec%60;
    timeStr=m+':'+String(s).padStart(2,'0');
  }
  if(statsEl){
    statsEl.innerHTML=`<span><strong>${ok}</strong> bonnes</span><span class="qr-dot">·</span><span><strong>${S.qcm.stats.ko}</strong> erreurs</span><span class="qr-dot">·</span><span>${timeStr}</span>`;
  }
    const rawWr=S.qcm.wrongs||[];
  const seen=new Set();const wr=[];
  for(const q of rawWr){
    if(!q||seen.has(q.id))continue;
    seen.add(q.id);wr.push(q);
    if(wr.length>=3)break;
  }
  if(errEl){
    if(wr.length){
      errEl.innerHTML='<div class="qr-err-hd">À revoir</div>'+wr.map(q=>{
        const goodRaw=q.opts&&q.opts[q.c]!==undefined?String(q.opts[q.c]):'—';
        const good=eh(goodRaw);
        const qq=(q.q||'').length>72?(q.q.slice(0,70)+'…'):q.q;
        return`<div class="qr-err-row"><div class="qr-err-q">${eh(qq)}</div><div class="qr-err-ok">✓ ${good}</div></div>`;
      }).join('');
    }else{
      errEl.innerHTML='<div class="qr-err-none">Aucune erreur dans cette session 🎯</div>';
    }
  }
  if(xpEl){
    xpEl.textContent='+0 XP';
    xpEl.style.opacity='0';
    xpEl.style.transform='translateY(22px)';
    requestAnimationFrame(()=>{
      xpEl.style.transition='opacity .45s ease, transform .65s cubic-bezier(.34,1.3,.64,1)';
      xpEl.style.opacity='1';
      xpEl.style.transform='translateY(0)';
      let n=0;const tgt=xpGain;const step=Math.max(1,Math.ceil(tgt/18));
      const iv=setInterval(()=>{
        n=Math.min(n+step,tgt);
        xpEl.textContent='+'+n+' XP';
        if(n>=tgt)clearInterval(iv);
      },28);
    });
  }
  const pct=tot>0?Math.round(ok/tot*100):0;
  if(pct>=80)confetti(false);
  if(tot>=10&&S.qcm.stats.ko===0){if(!S.perfectSessions)S.perfectSessions=0;S.perfectSessions++;save();}
  BADGES.checkAll();
}
function replayLastQcmSession(){
  const r=S.qcm.lastReplay;
  if(!r){showToast('Impossible de rejouer cette session','err');return;}
  const _qr3=document.getElementById('qcm-results');if(_qr3)_qr3.style.display='none';
  const _rm3=document.getElementById('rev-menu');if(_rm3)_rm3.style.display='none';
  if(r.kind==='exam')startExamSession(r.n,r.min);
  else if(r.kind==='flash')startFlashSession();
  else if(r.kind==='theme'&&r.cat)startSession(r.cat);
  else startSmartSession();
}
function exitQCM(){stopExamBanner();backToRevision();}
function backToRevision(){
  const _qs4=document.getElementById('qcm-session');if(_qs4)_qs4.style.display='none';
  const _qr4=document.getElementById('qcm-results');if(_qr4)_qr4.style.display='none';
  const _rm4=document.getElementById('rev-menu');if(_rm4)_rm4.style.display='block';
  updateDueCount();renderRevThemes();setRevTab(normalizeRevTab(S.rev?.tab)||'reviser');
}
function startExamBanner(minutes){
  let secs=minutes*60;const el=document.getElementById('qcm-timer');
  _examTimer=setInterval(()=>{
    if(!el)return;
    const m=String(Math.floor(secs/60)).padStart(2,'0'),s=String(secs%60).padStart(2,'0');
    el.textContent=m+':'+s;
    if(secs<=0){clearInterval(_examTimer);finishSession();return;}
    secs--;
  },1000);
}
function stopExamBanner(){clearInterval(_examTimer);_examTimer=null;const el=document.getElementById('qcm-timer');if(el)el.textContent='';}

/* ─── CR TIMER ─── */
let _crPhase=1,_crTimer=null;
function startCRTimer(){_crPhase=1;const _cov=document.getElementById('cr-timer-ov');if(_cov)_cov.style.display='flex';runCRPhase();}
function runCRPhase(){
  clearInterval(_crTimer);
  const lbl=document.getElementById('cr-phase-lbl'),disp=document.getElementById('cr-timer-disp'),sub=document.getElementById('cr-phase-sub'),skip=document.getElementById('cr-skip-btn');
  const secs=_crPhase===1?40*60:20*60;
  if(lbl)lbl.textContent=_crPhase===1?'📝 Préparation':'🎤 CR oral — À vous !';
  if(skip)skip.style.display=_crPhase===1?'block':'none';
  let s=secs;
  const tick=()=>{
    const m=String(Math.floor(s/60)).padStart(2,'0'),sec=String(s%60).padStart(2,'0');
    if(disp)disp.textContent=m+':'+sec;
    if(s<=0){clearInterval(_crTimer);if(_crPhase===1)skipCRPhase();else stopCRTimer();}s--;
  };
  tick();_crTimer=setInterval(tick,1000);
}
function skipCRPhase(){_crPhase=2;runCRPhase();}
function stopCRTimer(){
  clearInterval(_crTimer);
  const _cov2=document.getElementById('cr-timer-ov');if(_cov2)_cov2.style.display='none';
  if(!S.crDone)S.crDone=0;S.crDone++;save();
  BADGES.checkAll();
}

/* ─── PROFIL ─── */
function renderProfil(){
  const g=getGrade(),n=getNextGrade(),pct=getXPPct();
  const el=id=>document.getElementById(id);
  /* ID Card */
  const cardBadge=el('pr-card-badge');
  const cardGrade=el('pr-card-grade');
  const cardName=el('pr-card-name');
  const cardXp=el('pr-card-xp');
  const cardStreak=el('pr-card-streak');
  const cardSess=el('pr-card-sessions');
  const cardRecord=el('pr-card-record');
  if(cardBadge)cardBadge.innerHTML=gradeSvg(g);
  if(cardGrade)cardGrade.textContent=g.name;
  if(cardName)cardName.textContent=S.user.name||'Officier';
  if(cardXp)cardXp.textContent=(S.user.xp||0).toLocaleString('fr-FR')+' XP';
  if(cardStreak)cardStreak.textContent=S.user.streak||0;
  if(cardSess)cardSess.textContent=S.user.sessionsDone||0;
  if(cardRecord)cardRecord.textContent=S.user.streakRecord||0;
  if(el('pr-grade-ico'))el('pr-grade-ico').innerHTML=gradeSvg(g);
  if(el('pr-name'))el('pr-name').textContent=eh(S.user.name);
  if(el('pr-grade'))el('pr-grade').textContent=g.name;
  if(el('pr-xp-lbl'))el('pr-xp-lbl').textContent=S.user.xp+(n?' / '+n.min:'')+' XP';
  if(el('pr-xp-pct'))el('pr-xp-pct').textContent=pct+'%';
  if(el('pr-xpbar'))el('pr-xpbar').style.width=pct+'%';
  // Animer le ring XP
  const ring=el('pr-xp-ring');
  if(ring){const total=276.5;ring.style.transition='none';ring.style.strokeDashoffset=total;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ring.style.transition='stroke-dashoffset .8s cubic-bezier(.34,1.56,.64,1)';ring.style.strokeDashoffset=total*(1-pct/100);}));}
  if(el('pr-streak'))el('pr-streak').innerHTML='<span class="pr-streak-num">'+(S.user.streak||0)+'</span>'+PROFIL_STREAK_SVG;
  if(el('pr-lessons'))el('pr-lessons').textContent=Object.keys(S.lessons).length;
  if(el('pr-qcm'))el('pr-qcm').textContent=Object.keys(S.qcm.cards).length;
  if(el('pr-streak-v'))el('pr-streak-v').innerHTML='<span>'+(S.user.streakRecord||0)+'</span>'+PROFIL_STREAK_SVG;
  const vals=Object.values(S.qcm.cards);
  const totalOk=vals.reduce((a,c)=>a+(c.ok||0),0);
  const totalAll=vals.reduce((a,c)=>a+(c.ok||0)+(c.ko||0),0);
  if(el('pr-acc'))el('pr-acc').textContent=totalAll>0?Math.round(totalOk/totalAll*100)+'%':'—';
  const heroCard=document.querySelector('#p-profil .profil-hero-card');
  if(heroCard){
    heroCard.style.borderColor=S.user.streak>=7
      ?'rgba(200,146,26,.4)'
      :'var(--brd)';
  }
  requestAnimationFrame(()=>{
    renderActivityBars();
    renderRadar28();
    BADGES.renderGrid();
    THEME28.apply();
  });
  const progEl=document.getElementById('pr-prog-30');
  if(progEl){
    const today=new Date();
    let html='<div class="prog-30-grid">';
    for(let i=29;i>=0;i--){
      const d=new Date(today);
      d.setDate(d.getDate()-i);
      const key=d.toDateString();
      const active=S.activity&&S.activity[key];
      html+=`<div class="prog-day ${active?'active':''}" title="${d.toLocaleDateString('fr-FR')}"></div>`;
    }
    html+='</div>';
    progEl.innerHTML=html;
  }
  const readyEl=document.getElementById('pr-readiness');
  if(readyEl){
    const totalQ=QB.length;
    const mastered=QB.filter(q=>{const c=S.qcm.cards[q.id];return c&&c.reps>=2&&!FSRS.isDue(c);}).length;
    const lessonsDone=Object.keys(S.lessons).length;
    const totalLessons=CHAPTERS.flatMap(c=>c.lessons).length;
    const qPct=totalQ>0?mastered/totalQ:0;
    const lPct=totalLessons>0?lessonsDone/totalLessons:0;
    const readiness=Math.round((qPct*0.6+lPct*0.4)*100);
    readyEl.innerHTML=`
      <div class="readiness-score">${readiness}<span class="readiness-pct">%</span></div>
      <div class="readiness-label">Prêt pour l'examen</div>
      <div class="readiness-bar"><div class="readiness-fill" style="width:${readiness}%"></div></div>
      <div class="readiness-detail">${mastered}/${totalQ} QCM maîtrisés · ${lessonsDone}/${totalLessons} leçons</div>
    `;
  }
  const lacEl=document.getElementById('pr-module-lacunes');
  if(lacEl)lacEl.innerHTML=renderModuleLacunesOralHtml();
  const exHist=document.getElementById('pr-exam-history');
  if(exHist)exHist.innerHTML=renderExamHistoryHtml();
  renderRevisionPlan();
}
function renderActivityBars(){
  const el=document.getElementById('pr-activity-bars');if(!el)return;
  const lbl=document.getElementById('pr-activity-lbl');
  if(lbl)lbl.textContent='Activité récente';
  const today=Date.now();
  const bars=Array.from({length:30},(_,i)=>{
    const d=new Date(today-i*86400000).toDateString();
    return{active:!!S.activity?.[d],isStreak:false};
  }).reverse();
  el.innerHTML=bars.map(b=>`<div class="activity-bar${b.active?' active':''}" style="height:${b.active?'100':'25'}%"></div>`).join('');
}
function renderRadar28(){
  const labels=['GAV','Flagrance','Mandats','Infractions','Libertés','Procédure'];
  const cats=[['GAV'],['FLAGRANCE'],['MANDATS','MESURES_COERC'],['INFRACTIONS'],['LIBERTES'],['PERQUIZ','COMMISSION']];
  const vals=cats.map(cl=>{
    const pool=QB.filter(q=>cl.includes(q.cat));if(!pool.length)return 0;
    const ok=pool.filter(q=>(S.qcm.cards[q.id]?.ok||0)>0).length;
    return Math.round(ok/pool.length*100);
  });
  renderRadar('pr-radar',labels,vals);
}
function renderRadar(id,labels,values){
  const el=document.getElementById(id);if(!el)return;
  const sz=240,cx=120,cy=120,r=80,n=labels.length;
  const pts=labels.map((_,i)=>{const a=Math.PI*2/n*i-Math.PI/2;return{x:cx+r*Math.cos(a),y:cy+r*Math.sin(a),lx:cx+(r+22)*Math.cos(a),ly:cy+(r+22)*Math.sin(a)};});
  const grids=[25,50,75,100].map(lvl=>{
    const gpts=pts.map((_,i)=>{const a=Math.PI*2/n*i-Math.PI/2,rv=r*lvl/100;return`${cx+rv*Math.cos(a)},${cy+rv*Math.sin(a)}`;}).join(' ');
    return`<polygon points="${gpts}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="1"/>`;
  }).join('');
  const axes=pts.map(p=>`<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="rgba(255,255,255,.08)" stroke-width="1"/>`).join('');
  const data=values.map((v,i)=>{const a=Math.PI*2/n*i-Math.PI/2,rv=r*v/100;return`${cx+rv*Math.cos(a)},${cy+rv*Math.sin(a)}`;}).join(' ');
  const lbls=labels.map((l,i)=>`<text x="${pts[i].lx}" y="${pts[i].ly}" text-anchor="middle" dominant-baseline="middle" fill="rgba(240,246,255,.45)" font-size="9" font-family="JetBrains Mono,monospace">${l}</text>`).join('');
  el.innerHTML=`<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" style="max-width:100%"><g>${grids}${axes}<polygon points="${data}" fill="rgba(37,99,235,.15)" stroke="rgba(59,130,246,.7)" stroke-width="1.5"/>${lbls}</g></svg>`;
}
function showGrades(){
  const html=`<div style="padding:18px">
    <div class="font-title fw-800 text-xl mb16">Parcours habilitation OPJ</div>
    ${GRADES.map(gr=>`<div style="display:flex;align-items:center;gap:12px;padding:9px;background:${S.user.xp>=gr.min?'var(--accent-glow)':'transparent'};border-radius:var(--r-m);margin-bottom:4px">
      <span class="grade-table-svg" style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;flex-shrink:0">${gradeSvg(gr)}</span>
      <div style="flex:1"><div class="text-sm fw-700" style="color:${S.user.xp>=gr.min?'var(--t1)':'var(--t3)'}">${gr.name}</div><div class="text-xs text-muted font-mono">${gr.min} XP requis</div></div>
      ${S.user.xp>=gr.min?'<span class="text-ok">✓</span>':''}
    </div>`).join('')}
    <button class="btn btn-ghost btn-full mt12" onclick="closeLesson()">Fermer</button>
  </div>`;
  const _lm2=document.getElementById('lesson-modal-body');if(_lm2)_lm2.innerHTML=html;
  const _lo2=document.getElementById('lesson-ov');if(_lo2)_lo2.classList.add('on');
  document.body.style.overflow='hidden';
}
function resetData(){
  if(!confirm('Réinitialiser toute la progression ? Cette action est irréversible.'))return;
  const name=S.user.name;S=defaultState();S.user.name=name;S.page='home';save();
  navigateTo('home');showToast('Progression réinitialisée','ok');
}
function doLogout(){try{AUTH.logout();}catch(e){showToast('Erreur déconnexion','err');}}

/* ─── CARTOUCHES ─── */


const CR_DOSSIERS=[
{id:1,titre:"Personne grièvement blessée",emoji:"🩸",cadre:"Flagrance",qual:"Tentative homicide / Violences aggravées",tags:["Flagrance","Art. 222-1 CP","Urgence"],
faits:"À 23h15, votre patrouille est appelée pour une personne inconsciente rue des Acacias. Vous découvrez M. MARTIN Thierry, 34 ans, crâne fracturé. SAMU en route. Témoin DUPONT René signale un suspect masculin, veste rouge, fuite il y a 10 minutes.",
qualification:"Tentative d'homicide volontaire art. 221-1 CP ou violences aggravées nuit/guet-apens art. 222-8 CP. Cadre : flagrance art. 53 CPP.",
pieges:["Qualifier au plus grave sans attendre le pronostic vital","Préciser et justifier le cadre flagrance","Demander autorisation GAV dès interpellation","Sécuriser la scène : témoins, traces, vidéosurveillance"],
corrige:"Monsieur le Procureur, OPJ [NOM], brigade [SERVICE], il est [HEURE].\n\nJe vous rends compte de la découverte d'une personne grièvement blessée rue des Acacias, ce jour à 23h15.\n\nQUALIFICATION : Tentative d'homicide volontaire — art. 221-1 al.1 CP.\nCADRE : Enquête de flagrance — art. 53 CPP.\nFAITS : Victime inconsciente, crâne fracturé. Témoin DUPONT René signale suspect veste rouge, fuite il y a 10 min.\nACTES RÉALISÉS : Sécurisation scène. Demande SAMU. Recueil déposition DUPONT.\nDEMANDES : Autorisation GAV suspect dès interpellation. Réquisitions vidéosurveillance. Avis médecin légiste.\n\nJe reste disponible."},
{id:2,titre:"Cambriolage en cours",emoji:"🏠",cadre:"Flagrance",qual:"Vol aggravé — Art. 311-4 CP",tags:["Flagrance","Art. 311-4 CP","GAV"],
faits:"À 02h30, deux individus dans une bijouterie fermée, vitrine brisée. Interpellation de SAID Karim, 22 ans : 12 montres + pied de biche. Un complice fuit par les toits. Propriétaire M. CHEN confirme.",
qualification:"Vol aggravé effraction + nuit + réunion — art. 311-4 2° et 4° CP. Flagrance art. 53 CPP.",
pieges:["Cumuler les circonstances aggravantes","Demander perquisition domicile","Signalement complice","Sceller séparément chaque objet"],
corrige:"Monsieur le Procureur, OPJ [NOM], brigade [SERVICE].\n\nVol aggravé effraction + nuit + réunion — art. 311-4 2° et 4° CP.\nFlagrance art. 53 CPP.\n\nSAID Karim interpellé avec 12 montres et pied de biche. Complice en fuite.\n\nDEMANDES : GAV SAID. Perquisition domicile. Signalement complice. Réquisitions caméra."},
{id:3,titre:"Violences conjugales habituelles",emoji:"👊",cadre:"Préliminaire",qual:"Violences habituelles — Art. 222-14 CP",tags:["Préliminaire","Art. 222-14 CP"],
faits:"Mme PETIT Sophie, 31 ans, se présente. Violences répétées sur 6 mois par son conjoint. Certificat médical : ITT 5 jours. Main courante en mars. Deux enfants mineurs au domicile.",
qualification:"Violences habituelles sur conjoint, ITT < 8 jours, présence enfants — art. 222-14 2° et 3° CP.",
pieges:["HABITUALITÉ art. 222-14 ≠ violences simples","Vérifier si enfants témoins → aggravante","Pas de perquisition sans accord ou JLD en préliminaire","Réaliser l'EVVI"],
corrige:"Madame la Procureure, OPJ [NOM].\n\nViolences habituelles sur conjoint, ITT 5 jours, présence enfants — art. 222-14 2° et 3° CP.\nPréliminaire — faits sur 6 mois.\n\nDEMANDES : GAV M. LEROY. JLD pour perquisition si refus. Saisine JAF."},
{id:4,titre:"Trafic de stupéfiants — bande organisée",emoji:"💊",cadre:"Flagrance + CO",qual:"Trafic stups bande organisée — Art. 222-34 CP",tags:["Criminalité organisée","Art. 222-37 CP","GAV 96h"],
faits:"Après 3 semaines de surveillance, interpellation de GARCIA Pablo, 28 ans. Sur lui : 250g cocaïne, 3 500 € espèces. Sur TRAN Van, 24 ans : 2g usage perso.",
qualification:"GARCIA : trafic cocaïne bande organisée — art. 222-34. TRAN : usage — L3421-1 CSP.",
pieges:["Distinguer GARCIA (trafiquant) et TRAN (usage)","Régime dérogatoire CO","Saisir les avoirs criminels"],
corrige:"Monsieur le Procureur, OPJ [NOM].\n\nGARCIA : trafic cocaïne BO — art. 222-34. TRAN : usage — L3421-1.\nRégime CO art. 706-73.\n\nDEMANDES : GAV GARCIA CO 96h JLD. GAV TRAN droit commun. Saisie 3 500 €."},
{id:5,titre:"Accident — délit de fuite + alcool",emoji:"🚗",cadre:"Flagrance",qual:"Blessures involontaires aggravées — Art. 222-19-1 CP",tags:["Flagrance","Art. 222-19-1 CP","Alcool"],
faits:"À 20h30, M. ROUSSEAU Bernard renverse un cycliste en brûlant un feu et prend la fuite. Interpellé 2h30 plus tard. Alcoolémie : 1,8 g/l. Victime : fracture bassin + commotion — ITT 6 semaines.",
qualification:"Blessures involontaires aggravées alcool + délit de fuite — art. 222-19-1 CP.",
pieges:["ITT ≥ 3 mois → aggravante spécifique","Cumuler infractions code de la route","Immobiliser le véhicule"],
corrige:"Monsieur le Procureur, OPJ [NOM].\n\nBlessures involontaires ITT > 3 mois + délit de fuite + alcool 1,8 g/l.\nFlagrance art. 53 CPP.\n\nDEMANDES : GAV ROUSSEAU. Rétention permis. Mise en fourrière."},
{id:6,titre:"Découverte d'un corps",emoji:"💀",cadre:"Art. 74 CPP",qual:"Mort suspecte — Art. 74 CPP",tags:["Art. 74 CPP","Cause inconnue","Médecin légiste"],
faits:"À 06h15, découverte d'un homme décédé dans un parc. Aucune trace visible de violence. Identité inconnue.",
qualification:"Art. 74 CPP — enquête sur les causes de la mort.",
pieges:["Ne pas qualifier avant autopsie","Ne pas ouvrir une information judiciaire soi-même","Périmètre de sécurité IMMÉDIAT"],
corrige:"Monsieur le Procureur, OPJ [NOM].\n\nDécouverte de corps de cause inconnue. Art. 74 CPP.\n\nDEMANDES : Réquisition médecin légiste. Identification victime. Votre décision sur saisine JI si cause suspecte."},
{id:7,titre:"Vol avec violence en réunion",emoji:"👊",cadre:"Flagrance",qual:"Vol avec violence en réunion — Art. 311-5 CPn",tags:["Flagrance","Art. 311-5 CPn","GAV"],
faits:"À 14h30, trois individus arrachent téléphone et portefeuille en frappant la victime. Un suspect interpellé 200 m plus loin avec le téléphone. La victime saigne du nez.",
qualification:"Vol avec violence en réunion — art. 311-5 + 311-6 CPn.",
pieges:["Vérifier que la FLAGRANCE est bien caractérisée","ITT à demander","Co-auteurs en fuite : fiche de recherche"],
corrige:"Monsieur le Procureur, OPJ [NOM].\n\nVol avec violence en réunion — art. 311-5 + 311-6 CPn.\n\nDEMANDES : GAV suspect. ITT victime. Diffusion co-auteurs."},
{id:8,titre:"Violence conjugale — retrait de plainte",emoji:"👁",cadre:"Préliminaire",qual:"Violences conjugales — Art. 222-11 + 132-80 CPn",tags:["Art. 132-80","Violences conjugales"],
faits:"À 22h45, intervention pour cris. La femme présente un hématome à l'œil. Elle refuse de porter plainte. Le mari nie.",
qualification:"Violences volontaires + aggravante conjoint art. 132-80.",
pieges:["Le retrait de plainte ne met PAS fin aux poursuites","L'OPJ peut procéder même sans plainte","EVVI obligatoire"],
corrige:"Madame la Procureure, OPJ [NOM].\n\nViolences conjugales — art. 222-11 + 132-80 CPn.\n\nVictime refuse plainte — procédure d'initiative. EVVI réalisée.\n\nDEMANDES : GAV du mari ? Éloignement ? ITT."},
{id:9,titre:"Trafic de stupéfiants — contrôle routier",emoji:"🔍",cadre:"Préliminaire / Flagrance",qual:"Détention de stupéfiants — Art. 222-37 CPn",tags:["Art. 222-37 CPn","Saisie"],
faits:"Lors d'un contrôle, conducteur nerveux. Coffre : 1 kg résine cannabis + 3 500 € en liquide. Il nie.",
qualification:"Détention et transport de stupéfiants — art. 222-37.",
pieges:["1 kg + argent liquide = faisceau d'indices de trafic","Saisir les 3 500 €","Si réseau suspecté : saisine OCTRIS"],
corrige:"Monsieur le Procureur, OPJ [NOM].\n\nDétention et transport stups — art. 222-37 CPn. 1 kg cannabis + 3 500 €.\n\nDEMANDES : GAV. Saisie avoirs. Saisine OCTRIS si réseau."},
{id:10,titre:"Mineur — violences au collège",emoji:"🎒",cadre:"CJPM 2021",qual:"Violences ITT > 8 jours — Art. 222-11 CPn",tags:["CJPM 2021","Mineur","Art. 222-11"],
faits:"Un élève de 15 ans a frappé un camarade. La victime est transportée SAMU (fracture du nez probable). Parents injoignables.",
qualification:"Violences volontaires ITT > 8 jours — art. 222-11. CJPM 2021.",
pieges:["NE PAS appliquer les règles des majeurs","Avocat DÈS le début","Si parents injoignables : administrateur ad hoc"],
corrige:"Monsieur le Procureur, OPJ [NOM].\n\nViolences ITT > 8 jours MINEUR 15 ans — art. 222-11 + CJPM 2021.\n\nDEMANDES : GAV ou retenue ? Saisine JE ? ITT."},
{id:11,titre:"Outrage + rébellion + violences sur PDAP",emoji:"🚨",cadre:"Flagrance",qual:"Art. 433-5 + 433-6 + 222-13 CPn",tags:["Art. 433-5 CPn","PDAP"],
faits:"Lors d'un contrôle d'identité, un homme insulte les agents puis frappe un collègue à l'épaule (ITT 0 jour) et tombe volontairement au sol.",
qualification:"Outrage art. 433-5 + Rébellion art. 433-6 + Violences sur PDAP art. 222-13.",
pieges:["Résistance PASSIVE ≠ rébellion. Ici il frappe → rébellion + violences","CUMUL outrage + rébellion : oui","Demander certificat médical pour le collègue"],
corrige:"Monsieur le Procureur, OPJ [NOM].\n\nOutrage + Rébellion + Violences sur PDAP — art. 433-5, 433-6, 222-13.\n\nDEMANDES : GAV. Certificat médical collègue blessé."}
];

/* PLAN12 supprimé — inutilisé */

/* ANNALES, LIBERTES_DATA → js/data/annales.js | PB, LECONS → js/data/procedures.js */
/* SUPPRIMÉ ICI — ces constantes sont chargées via <script> avant app.js */

/* LEC legacy supprimé — remplacé par CHAPTERS + renderLecons() */
const LEC={render(){},open(){},markDone(){},close(){}};

/* ═══════════════════════════════════════════════════
   LIBERTÉS PUBLIQUES — OPJ ELITE v22.0
   ═══════════════════════════════════════════════════ */



/* ═══ LP — LIBERTÉS PUBLIQUES ═══ */

function lpFilter(btn,src){
  document.querySelectorAll('.lp-src-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.lp-card2').forEach(card=>{
    card.style.display=(src==='all'||card.dataset.src===src)?'block':'none';
  });
}
const LP={

  render(){
    const el=document.getElementById('lp-list');if(!el)return;
    let done={};try{const r=localStorage.getItem('opj_lp');if(r)done=JSON.parse(r);}catch(e){}
    const dc=Object.keys(done).length;
    const pct=LIBERTES_DATA.length?Math.round(dc/LIBERTES_DATA.length*100):0;

    const SOURCE_META={
      'DDHC':{bg:'rgba(245,158,11,.15)',c:'#f59e0b',label:'DDHC 1789',icon:'📜'},
      'CEDH':{bg:'rgba(59,130,246,.15)',c:'#3b82f6',label:'CEDH',icon:'🇪🇺'},
      'CONST':{bg:'rgba(16,185,129,.15)',c:'#10b981',label:'Constitution',icon:'🏛️'},
      'CPP':{bg:'rgba(139,92,246,.15)',c:'#8b5cf6',label:'CPP',icon:'⚖️'},
      'CP':{bg:'rgba(239,68,68,.15)',c:'#ef4444',label:'Code Pénal',icon:'⚡'},
      'CJPM':{bg:'rgba(34,211,238,.15)',c:'#22d3ee',label:'CJPM',icon:'👶'},
    };
    const srcMeta=(ref)=>{
      if(ref.includes('DDHC'))return SOURCE_META['DDHC'];
      if(ref.includes('CEDH'))return SOURCE_META['CEDH'];
      if(ref.includes('Const')||ref.includes('66'))return SOURCE_META['CONST'];
      if(ref.includes('CPP'))return SOURCE_META['CPP'];
      if(ref.includes('CPen')||ref.includes(' CP'))return SOURCE_META['CP'];
      if(ref.includes('CJPM'))return SOURCE_META['CJPM'];
      return SOURCE_META['CPP'];
    };

    /* Grouper par source */
    const groups2={};
    LIBERTES_DATA.forEach(l=>{
      const sm=srcMeta(l.ref);
      const key=sm.label;
      if(!groups2[key])groups2[key]={meta:sm,items:[]};
      groups2[key].items.push(l);
    });

    el.innerHTML=`
    <div class="lp-hero">
      <div class="lp-hero-top">
        <div>
          <div class="lp-hero-title">🏛️ Libertés &amp; Droits fondamentaux</div>
          <div class="lp-hero-sub">${LIBERTES_DATA.length} principes · Examen OPJ</div>
        </div>
        <div class="lp-hero-score">
          <div class="lp-hero-pct">${pct}%</div>
          <div class="lp-hero-pct-l">${dc}/${LIBERTES_DATA.length}</div>
        </div>
      </div>
      <div class="lp-hero-bar"><div class="lp-hero-fill" style="width:${pct}%;background:linear-gradient(90deg,#3b82f6,#d4af37)"></div></div>
    </div>

    <div class="lp-source-tabs" id="lp-source-tabs">
      <button class="lp-src-tab active" onclick="lpFilter(this,'all')">Tout</button>
      ${Object.entries(groups2).map(([k,g])=>`
        <button class="lp-src-tab" onclick="lpFilter(this,'${k}')" style="--sc:${g.meta.c}">
          ${g.meta.icon} ${k}
        </button>`).join('')}
    </div>

    <div class="lp-cards-wrap" id="lp-cards-wrap">
    ${LIBERTES_DATA.map((l,i)=>{
      const isDone=!!done[l.id];
      const sm=srcMeta(l.ref);
      const defPrev=(l.def||'').slice(0,100)+(l.def&&l.def.length>100?'…':'');
      const pts=(l.points||[]).slice(0,2);
      return`<div class="lp-card2${isDone?' done':''}" data-src="${sm.label}" onclick="LP.open('${l.id}')"
              style="animation:fadeUp .18s ${i*0.025}s both;--lc:${sm.c}">
        <div class="lp-card2-head">
          <div class="lp-card2-em">${l.em}</div>
          <div class="lp-card2-badges">
            <span class="lp-src-badge" style="background:${sm.bg};color:${sm.c}">${sm.icon} ${sm.label}</span>
            ${isDone?'<span class="lp-done-badge">✓ Maîtrisée</span>':''}
          </div>
        </div>
        <div class="lp-card2-nm">${l.nm}</div>
        <div class="lp-card2-ref">${l.ref}</div>
        <div class="lp-card2-def">${defPrev}</div>
        ${pts.length?`<ul class="lp-card2-pts">${pts.map(p=>`<li>${p}</li>`).join('')}</ul>`:''}
        ${l.piege?`<div class="lp-card2-piege">⚠️ ${l.piege.slice(0,80)}${l.piege.length>80?'…':''}</div>`:''}
        <div class="lp-card2-footer">
          <span class="lp-card2-cta">${isDone?'Relire':'Apprendre →'}</span>
        </div>
      </div>`;
    }).join('')}
    </div>`;
  },
  open(id){
    // FIX #2 v21 — mutex : fermer LEC si ouvert
    if(typeof LEC!=='undefined'&&document.getElementById('lec-ov')?.classList.contains('on')) LEC.close();
    const l=LIBERTES_DATA.find(x=>x.id===id); if(!l)return;
    let done={};try{const r=localStorage.getItem('opj_lp');if(r)done=JSON.parse(r);}catch(e){}
    let h=`<span class="bs-pill"></span>
    <div class="bs-hd" style="padding:0;position:relative">
      <button class="bs-close" onclick="LP.close()" style="position:absolute;top:13px;right:13px">✕</button>
      <div class="lm-hero">
        <span class="lm-em">${l.em}</span>
        <div class="lm-nm">${l.nm}</div>
        <div class="lm-mt">${l.ref}</div>
      </div>
    </div>
    <div class="bs-bd">
      <div class="lm-intro">${l.def}</div>
      <div class="lm-sec-t">📌 Points essentiels</div>
      ${(l.points||[]).map(p=>`<div class="lm-item">${p}</div>`).join('')}
      ${l.piege?`<div class="fm-piege"><div class="fm-piege-t">⚠️ Piège d'examen</div><div class="fm-piege-c">${l.piege}</div></div>`:''}
      <div style="padding:14px">
        <button onclick="LP.markDone('${id}')" style="width:100%;padding:12px;border-radius:13px;border:none;background:linear-gradient(135deg,#D4AF37,#e8c84a 50%,#b8941f);color:#000;font-family:Inter,sans-serif;font-size:13px;font-weight:800;cursor:pointer">
          ${done[id]?'✓ Relire encore':'Marquer comme maîtrisée +10 XP'}
        </button>
      </div>
    </div>`;
    const ov=document.getElementById('lec-ov'),bd=document.getElementById('lec-bd');
    if(ov&&bd){bd.innerHTML=h;ov.classList.add('on');document.body.style.overflow='hidden';}
  },
  markDone(id){
    let done={};try{const r=localStorage.getItem('opj_lp');if(r)done=JSON.parse(r);}catch(e){}
    if(!done[id]){done[id]=1;localStorage.setItem('opj_lp',JSON.stringify(done));addXP(10);showToast('+10 XP — Liberté maîtrisée !','ok');}
    LP.close();setTimeout(()=>LP.render(),100);
  },
  close(){
    const ov=document.getElementById('lec-ov');if(ov)ov.classList.remove('on');
    document.body.style.overflow='';
  }
};


/* PWA handled by static manifest.json and /sw.js */

/* ═══ PFM — FICHE PROCÉDURE MODAL ═══ */
/* NOTE: f.def, r.l, r.v, f.piege in PFM are static editorial text — not escaped */
const PFM={open(id){const f=PB.find(x=>x.id===id);if(!f)return;const rows=Array.isArray(f.tab)?f.tab:[];let h=`<span class="bs-pill"></span><div class="bs-hd"><div class="bs-hd-row"><div style="flex:1"><div style="font-size:11px;color:var(--t3);font-family:'JetBrains Mono',monospace;margin-bottom:3px">${eh(f.ref)}</div><div style="font-size:17px;font-weight:900;color:var(--t1)">${eh(f.nm)}</div></div><button class="bs-close" onclick="PFM.close()">✕</button></div></div><div class="bs-bd"><div style="font-size:13px;color:var(--t2);line-height:1.65;margin-bottom:14px;padding:11px 13px;background:var(--bg-2);border-radius:10px">${eh(f.def||'')}</div>`;rows.forEach(r=>{h+=`<div class="pr-row"><div class="pr-l">${eh(r.l)}</div><div class="pr-v">${eh(r.v)}</div></div>`;});if(f.piege)h+=`<div class="fm-piege" style="margin-top:14px"><div class="fm-piege-l">⚠ Piège</div><div style="font-size:12px;color:var(--t2);line-height:1.6">${eh(f.piege)}</div></div>`;h+=`</div><div class="bs-ft"><button class="btn-prim" onclick="PFM.close()">Fermer</button></div>`;const _pfb=document.getElementById('pf-body');if(_pfb)_pfb.innerHTML=h;const _pfo=document.getElementById('pf-ov');if(_pfo)_pfo.style.display='flex';document.body.style.overflow='hidden';},close(){const _pfo2=document.getElementById('pf-ov');if(_pfo2)_pfo2.style.display='none';document.body.style.overflow='';try{renderProcList();}catch(e){}}};

function renderQDJ(){
  const el=document.getElementById('h-qdj');if(!el)return;
  const today=new Date().toDateString();
  const dayIdx=Math.floor(Date.now()/86400000);
  const qIdx=dayIdx%QB.length;
  const qOrig=QB[qIdx];if(!qOrig)return;

  /* Shuffle déterministe basé sur le jour → même ordre toute la journée */
  const shuffledOpts=seededShuffle(qOrig.opts.map((opt,i)=>({opt,correct:i===qOrig.c})),dayIdx*137+qIdx);
  const q={...qOrig, opts:shuffledOpts.map(p=>p.opt), c:shuffledOpts.findIndex(p=>p.correct)};

  let stored=null;
  try{const raw=localStorage.getItem('opj_qdj');if(raw){const d=JSON.parse(raw);if(d.date===today)stored=d;}}catch(e){}

  /* Map catégorie → fiche */
  const QDJ_FICHE={
    'GAV':'F01','HOMICIDE':'F01','STUPS':'F11','USAGE':'F11','TRAFIC':'F14',
    'VOL':'F05','ESCRO':'F06','ABUS':'F07','RECEL':'F08','EXTORS':'F13',
    'VIOL':'F04','VIOLENCE':'F03','OUTRAGE':'F09','RÉBELLION':'F10',
    'CORRUPTION':'F15','ROUTE':'F12','ALCOOL':'F12','MEURTRE':'F01'
  };
  const qdjFicheId=(()=>{
    const cat=(qOrig.cat||'').toUpperCase();
    for(const [k,v] of Object.entries(QDJ_FICHE)){if(cat.includes(k))return v;}
    return null;
  })();

  if(stored){
    const ok=stored.correct;
    const explInner=qOrig.expl
      ? (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize
          ? DOMPurify.sanitize(String(qOrig.expl), { ALLOWED_TAGS: ['strong', 'em', 'br'], ALLOWED_ATTR: [] })
          : eh(String(qOrig.expl).replace(/<[^>]+>/g, '')))
      : '';
    const expl=explInner?('<div class="qdj-expl">'+explInner+'</div>'):'';
    const ficheBtn=qdjFicheId
      ?'<button type="button" class="qdj-fiche-btn" onclick="openFiche(\''+qdjFicheId+'\')">📖 Voir la fiche infraction</button>'
      :'';
    el.innerHTML=
      '<div class="qdj-premium qdj--answered">'
      +'<div class="qdj-badge-row"><span class="qdj-badge-main">⚡ Question du jour</span>'+(qOrig.ref?'<span class="qdj-badge-ref">'+eh(qOrig.ref)+'</span>':'')+'</div>'
      +'<div class="qdj-q">'+eh(qOrig.q)+'</div>'
      +'<div class="qdj-feedback qdj-feedback--'+(ok?'ok':'ko')+'">'
      +'<div class="qdj-feedback-title">'+(ok?'✅ Bonne réponse !':'❌ Pas tout à fait')+'</div>'
      +'<div class="qdj-feedback-ans">Réponse correcte : <strong>'+eh(qOrig.opts[qOrig.c])+'</strong></div>'
      +expl
      +'</div>'+ficheBtn+'</div>';
    return;
  }

  const letters=['A','B','C','D'];
  let opts='';
  q.opts.forEach((v,i)=>{
    opts+='<button type="button" class="qdj-opt-btn" onclick="answerQDJ('+i+')"><span class="qdj-opt-lbl">'+letters[i]+'</span><span>'+eh(v)+'</span></button>';
  });
  el.innerHTML=
    '<div class="qdj-premium">'
    +'<div class="qdj-badge-row"><span class="qdj-badge-main">⚡ Question du jour</span>'+(qOrig.ref?'<span class="qdj-badge-ref">'+eh(qOrig.ref)+'</span>':'')+'</div>'
    +'<div class="qdj-q">'+eh(qOrig.q)+'</div>'
    +'<div class="qdj-opts-premium">'+opts+'</div>'
    +'</div>';
}
function answerQDJ(answer){
  const dayIdx=Math.floor(Date.now()/86400000);
  const qOrig=QB[dayIdx%QB.length];if(!qOrig)return;
  /* Reconstituer le shuffle du jour */
  const shuffledOpts=seededShuffle(qOrig.opts.map((opt,i)=>({opt,correct:i===qOrig.c})),dayIdx*137+(dayIdx%QB.length));
  const shuffledC=shuffledOpts.findIndex(p=>p.correct);
  /* Accepter int (new) ou lettre A/B/C/D (legacy) */
  const i=typeof answer==='number'?answer:(answer.charCodeAt(0)-65);
  const ok=i===shuffledC;
  const today=new Date().toDateString();
  try{localStorage.setItem('opj_qdj',JSON.stringify({date:today,correct:ok,answer:i}));}catch(e){}
  if(ok&&new Date().getHours()<9){
    S.earlyBirdCount=(S.earlyBirdCount||0)+1;
  }
  const bonusEarlyBird=new Date().getHours()<9?10:0;
  const xpGained=(ok?20:5)+bonusEarlyBird;
  addXP(xpGained);
  S.tq++;S.dq++;if(ok){S.tcDone++;S.dcDone++;}
  save();
  const bonusTxt=bonusEarlyBird?' · +'+(bonusEarlyBird)+' XP bonus (avant 9h)':'';
  if(ok)showToast('+'+xpGained+' XP — Question du jour !'+bonusTxt,'ok');
  else showToast('+'+xpGained+' XP — participation enregistrée'+bonusTxt,'ok');
  renderQDJ();
}

const EVAL_CRITS=["J'ai correctement qualifié pénalement les faits","J'ai identifié le bon cadre d'enquête","J'ai mentionné les éléments constitutifs","J'ai structuré le CR chronologiquement","J'ai utilisé le vocabulaire procédural exact","J'ai formulé une demande claire au procureur","J'ai mentionné les droits applicables","J'ai été concis et précis"];
const EVAL={answers:{},show(){this.answers={};document.getElementById('eval-result').style.display='none';document.getElementById('eval-list').innerHTML=EVAL_CRITS.map((t,i)=>`<div class="eval-crit"><div class="eval-crit-txt">${i+1}. ${t}</div><div class="eval-btns"><button class="eval-btn" id="ev-${i}-oui" onclick="EVAL.set(${i},true)">Oui</button><button class="eval-btn" id="ev-${i}-non" onclick="EVAL.set(${i},false)">Non</button></div></div>`).join('');document.getElementById('eval-ov').classList.add('a');document.body.style.overflow='hidden';},set(i,v){this.answers[i]=v;document.getElementById('ev-'+i+'-oui').className='eval-btn'+(v?' oui':'');document.getElementById('ev-'+i+'-non').className='eval-btn'+(!v?' non':'');},calc(){const total=EVAL_CRITS.length,ok=Object.values(this.answers).filter(v=>v).length;if(Object.keys(this.answers).length<total){showToast('Répondez à tous les critères','err');return;}const r=document.getElementById('eval-result');let msg,col;if(ok>=7){msg='✅ Excellent — Niveau examen atteint';col='var(--ok)';}else if(ok>=5){msg='🟧 Bien — Continuez à vous entraîner';col='var(--warn)';}else{msg='🔴 À retravailler';col='var(--err)';}r.style.display='block';r.innerHTML=`<div style="font-size:22px;font-weight:900;color:${col};margin-bottom:4px">${ok}/8</div><div style="font-size:14px;font-weight:700;color:${col}">${msg}</div>`;addXP(ok*5);showToast(`CR évalué : ${ok}/8 (+${ok*5} XP)`,'ok');},close(){document.getElementById('eval-ov').classList.remove('a');document.body.style.overflow='';}};

/* DOMContentLoaded vestige supprimé v30 */

/* ═══ C — CARTOUCHES ═══ */
/* Art. 64 CPP : mentions matérielles du PV ; droits du gardé = art. 63-1 (champ séparé explicite dans les rubriques). */
const CT={
  gav:{
    ti:'PV de Garde à Vue',
    st:'Mentions du procès-verbal (Art. 64 CPP) — droits notifiés (Art. 63-1 CPP)',
    fs:[
      {id:'ct-gav-identite',l:'Identité complète du gardé à vue',t:'text',h:'Nom, prénom, date/lieu de naissance, domicile',r:true},
      {id:'ct-gav-infraction',l:'Nature et date de l\'infraction',t:'text',h:'Qualification pénale + article',r:true},
      {id:'ct-gav-notif',l:'Notification des droits (art. 63-1 CPP)',t:'ta',h:'Droit de prévenir un proche, droit à un avocat, droit à un examen médical, droit de consulter le PV de notification et le certificat médical...',r:true},
      {id:'ct-gav-heuredeb',l:'Heure de début de la GAV',t:'dt',r:true},
      {id:'ct-gav-avispr',l:'Avis au Procureur de la République',t:'text',h:'Heure de l\'avis, nom du magistrat',r:true},
      {id:'ct-gav-avocat',l:'Avocat désigné / commis d\'office',t:'text',h:'Nom de l\'avocat, heure d\'arrivée',r:false},
      {id:'ct-gav-medecin',l:'Examen médical',t:'text',h:'Heure, nom du médecin, conclusions',r:false},
      {id:'ct-gav-auditions',l:'Auditions réalisées',t:'ta',h:'Résumé des auditions, heures de début/fin, repos',r:true},
      {id:'ct-gav-fin',l:'Heure de fin de GAV / suite donnée',t:'text',h:'Levée, prolongation, déferrement',r:true},
    ]
  },
  perq:{
    ti:'PV de Perquisition',
    st:'Mentions obligatoires — Art. 57 CPP',
    fs:[
      {id:'ct-perq-cadre',l:'Cadre juridique',t:'text',h:'Flagrance art. 56 / CR art. 151 / Préliminaire art. 76',r:true},
      {id:'ct-perq-lieu',l:'Adresse exacte de la perquisition',t:'text',h:'N°, rue, ville',r:true},
      {id:'ct-perq-heures',l:'Heures de début et de fin',t:'text',h:'Début : ... / Fin : ... (entre 6h et 21h sauf exceptions)',r:true},
      {id:'ct-perq-occupant',l:'Présence de l\'occupant des lieux',t:'text',h:'Nom de la personne présente ou représentants désignés (art. 57 al. 2 CPP)',r:true},
      {id:'ct-perq-objets',l:'Objets et documents saisis',t:'ta',h:'Description détaillée, mise sous scellés',r:true},
      {id:'ct-perq-inventaire',l:'Inventaire contradictoire',t:'ta',h:'Inventaire des objets saisis en présence de l\'occupant',r:true},
      {id:'ct-perq-consentement',l:'Consentement écrit (préliminaire)',t:'text',h:'Accord exprès manuscrit si enquête préliminaire (art. 76 CPP)',r:false},
      {id:'ct-perq-signature',l:'Signatures',t:'text',h:'OPJ + occupant des lieux (ou mention de refus)',r:true},
    ]
  }
};
Object.assign(CT, window.__OPJ_CT_EXTRA__ || {});

const C={cur:null,
  start(t){C.cur=t;const tpl=CT[t];if(!tpl){showToast('Cartouche indisponible','err');return;}document.getElementById('cm').style.display='none';document.getElementById('ct').style.display='none';document.getElementById('ca').style.display='block';document.getElementById('ca-bg').textContent=t.toUpperCase();document.getElementById('ca-ti').textContent=tpl.ti;document.getElementById('ca-st').textContent=tpl.st;document.getElementById('ca-r').style.display='none';window.scrollTo({top:0,behavior:'instant'});document.getElementById('ca-f').innerHTML=tpl.fs.map(f=>`<div class="mb12"><div class="ct-l">${eh(f.l)}${f.r?' <span style="color:var(--err)">*</span>':''}</div>${f.t==='ta'?`<textarea class="ct-i" id="${eh(f.id)}" rows="3" placeholder="${eh(f.h||'')}"></textarea>`:f.t==='dt'?`<input type="datetime-local" class="ct-i" id="${eh(f.id)}">`:`<input type="text" class="ct-i" id="${eh(f.id)}" placeholder="${eh(f.h||'')}">`}</div>`).join('')},
  validate(){const tpl=CT[C.cur];let ok=true,f=0,t=0;tpl.fs.forEach(x=>{const el=document.getElementById(x.id);if(x.r){t++;if(!el.value.trim()){el.classList.add('err');el.classList.remove('val');ok=false}else{el.classList.remove('err');el.classList.add('val');f++}}});const r=document.getElementById('ca-r');r.style.display='block';r.scrollIntoView({behavior:'smooth'});if(ok){S.cv++;S.pvDone=(S.pvDone||0)+1;addXP(25);save();r.innerHTML=`<div class="cd" style="border-color:var(--ok)"><div class="ex-h ex-ok">✓ Cartouche validée — ${f}/${t} champs</div><div class="ex-t">+25 XP</div></div>`}else r.innerHTML=`<div class="cd" style="border-color:var(--err)"><div class="ex-h ex-ko">✗ Incomplète — ${f}/${t} champs</div></div>`},
  timeline(){document.getElementById('cm').style.display='none';document.getElementById('ca').style.display='none';document.getElementById('ct').style.display='block';window.scrollTo({top:0,behavior:'instant'});const n=new Date();n.setMinutes(n.getMinutes()-n.getTimezoneOffset());document.getElementById('tl-start').value=n.toISOString().slice(0,16)},
  genTL(){const s=document.getElementById('tl-start').value,r=document.getElementById('tl-reg').value;if(!s){showToast('Saisissez une heure','ko');return}const st=new Date(s),evs=[],fmt=d=>d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),add=(d,h)=>new Date(d.getTime()+h*36e5),push=(d,txt,imp)=>evs.push({t:fmt(d),e:txt,a:imp?1:0});push(st,'Début GAV — privation de liberté / appréhension',0);push(st,'Notification IMMÉDIATE des droits (art. 63-1 CPP)',1);push(st,'Avis IMMÉDIAT au procureur (art. 63 al.2 CPP)',1);push(st,'Entretien avocat sans délai (loi du 22/04/2024)',1);push(add(st,24),'Fin 1ère période 24h — prolongation possible (PR, écrit motivé, art. 63-3)',1);if(r==='dc'){push(add(st,48),'FIN MAXIMALE 48h — droit commun (art. 63-3 CPP)',1)}else if(r==='co'){push(add(st,48),'48h — au-delà : prolongations sous contrôle du JLD (art. 706-88 CPP)',1);push(add(st,72),'72h — 3e période (JLD)',1);push(add(st,96),'FIN MAXIMALE 96h — criminalité organisée (706-88 CPP)',1)}else if(r==='terr'){push(add(st,48),'48h — prolongations dérogatoires : JLD (terrorisme, art. 706-88-1 CPP)',1);push(add(st,72),'72h — contrôle JLD',1);push(add(st,96),'96h — contrôle JLD',1);push(add(st,120),'120h — 5e période (JLD)',1);push(add(st,144),'FIN MAXIMALE 144h — terrorisme (art. 706-88-1 CPP)',1)}const regimeLabel=r==='dc'?'Droit commun (48h max)':r==='co'?'Criminalité organisée (96h max, JLD >48h)':'Terrorisme (144h max, 706-88-1 CPP)';document.getElementById('tl-out').innerHTML=`<div class="st">${regimeLabel}</div><div class="tl">${evs.map(e=>`<div class="tl-i${e.a?' al':''}"><div class="tl-dot"></div><div class="tl-time">${e.t}</div><div class="tl-ev">${e.e}</div></div>`).join('')}</div>`},
  back(){document.getElementById('cm').style.display='block';document.getElementById('ca').style.display='none';document.getElementById('ct').style.display='none';window.scrollTo({top:0,behavior:'instant'})}
};

const P={showPro(){document.getElementById('pro-modal-ov').classList.add('a');document.body.style.overflow='hidden';},hidePro(){document.getElementById('pro-modal-ov').classList.remove('a');document.body.style.overflow='';},buy(){P.hidePro();document.getElementById('pay-modal-ov').classList.add('a');document.body.style.overflow='hidden';},hidePay(){document.getElementById('pay-modal-ov').classList.remove('a');document.body.style.overflow='';},selectPlan(plan){document.querySelectorAll('.pay-plan').forEach(el=>el.classList.remove('sel'));document.getElementById('pay-plan-'+plan).classList.add('sel');P._selectedPlan=plan;},async confirmPay(){const email=document.getElementById('pay-email').value.trim();if(!email||!email.includes('@')){showToast('Entrez un email valide','err');return;}if(!currentUser){showToast('Connectez-vous d\'abord','err');return;}if(email.toLowerCase()!==(currentUser.email||'').toLowerCase()){showToast('L\'email doit correspondre à votre compte','err');return;}const plan=P._selectedPlan||'2m';P.hidePay();await STRIPE.createCheckout(plan);},restoreAccess(){showToast('Restauration locale PRO désactivée','warn');}};


/* ═══ ANNALES RENDERER ═══ */
function renderAnnalesList(){
  const el=document.getElementById('annales-list');if(!el)return;
  if(typeof ANNALES==='undefined'||!ANNALES.length){
    el.innerHTML='<div class="empty-state"><span class="empty-state-em">📝</span>Aucune annale disponible</div>';return;
  }
  const annDone=S.annalesDone||{};
  const doneCount=Object.keys(annDone).length;
  const matColors={
    'Procédure pénale':{c:'#3b82f6',bg:'rgba(59,130,246,.12)',em:'⚖️'},
    'Droit pénal':{c:'#a855f7',bg:'rgba(168,85,247,.12)',em:'📖'},
    'Rédaction':{c:'#10b981',bg:'rgba(16,185,129,.12)',em:'✍️'},
  };
  const COEFF_COLORS=['','#10b981','#f59e0b','#ef4444'];

  el.innerHTML=`
  <div style="display:flex;gap:8px;margin-bottom:16px;">
    <div style="flex:1;background:var(--bg-1);border:1px solid var(--brd);border-radius:12px;padding:12px;text-align:center;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:900;color:var(--accent-l);">${ANNALES.length}</div>
      <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-top:2px;">Sujets</div>
    </div>
    <div style="flex:1;background:var(--bg-1);border:1px solid var(--brd);border-radius:12px;padding:12px;text-align:center;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:900;color:var(--ok);">${doneCount}</div>
      <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-top:2px;">Traités</div>
    </div>
    <div style="flex:1;background:var(--bg-1);border:1px solid var(--brd);border-radius:12px;padding:12px;text-align:center;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:900;color:var(--gold);">${ANNALES.length>0?Math.round(doneCount/ANNALES.length*100):0}%</div>
      <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-top:2px;">Couverture</div>
    </div>
  </div>
  ${ANNALES.map((a,i)=>{
    const done=!!annDone[a.id];
    const mat=matColors[a.matiere]||{c:'#3b82f6',bg:'rgba(59,130,246,.12)',em:'📝'};
    const coeff=Math.min(a.coeff||1,3);
    return`<div class="ann-card${done?' done':''}" onclick="openAnnale('${a.id}')" style="animation:fadeUp .15s ${i*0.04}s both;--ac:${mat.c}">
      <div class="ann-card-left" style="background:${mat.bg}">
        <div class="ann-card-em">${mat.em}</div>
      </div>
      <div class="ann-card-body">
        <div class="ann-card-top">
          <span class="ann-mat-badge" style="background:${mat.bg};color:${mat.c}">${a.matiere||'—'}</span>
          ${done?`<span class="ann-done-badge">✓ Traité</span>`:''}
          ${a.coeff?`<span class="ann-coeff" style="color:${COEFF_COLORS[coeff]||'var(--t3)'}">Coeff ${a.coeff}</span>`:''}
        </div>
        <div class="ann-card-title">${eh(a.titre)}</div>
        <div class="ann-card-meta" style="display:flex;flex-wrap:wrap;
          align-items:center;gap:6px;margin-top:4px;">
          ${a.duree?`<span style="color:var(--t3);font-size:10px;
            font-family:'JetBrains Mono',monospace;">⏱ ${a.duree}</span>`:''}
          ${(a.motscles||[]).slice(0,2).map(m=>`<span style="
            background:var(--bg-3);
            border:1px solid var(--brd);
            border-radius:4px;
            padding:1px 6px;
            font-size:9px;
            font-family:'JetBrains Mono',monospace;
            color:var(--t2);
            white-space:nowrap;
          ">${eh(m)}</span>`).join('')}
        </div>
      </div>
      <div class="ann-card-arr">›</div>
    </div>`;
  }).join('')}`;
}


function openAnnale(id){
  const a=ANNALES.find(x=>x.id===id);
  if(!a)return;
  const ov=document.getElementById('ann-ov');
  const body=document.getElementById('ann-body');
  if(!ov||!body)return;

  // Marquer comme fait
  if(!S.annalesDone)S.annalesDone={};
  S.annalesDone[a.id]=true;
  save();

  let html=`<div style="margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:var(--accent-l);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">${eh(a.matiere||'Annale')}</div>
    <h3 style="font-size:19px;font-weight:900;color:var(--t1);margin-bottom:4px">${eh(a.titre)}</h3>
    ${a.duree?`<div style="font-size:12px;color:var(--t3);font-family:var(--fm,monospace)">${eh(a.duree)}</div>`:''}
  </div>`;

  /* NOTE: a.contexte, q.corrige, a.corrige_global may contain editorial HTML — not escaped */
  if(a.contexte){
    html+=`<div style="background:rgba(77,143,255,.07);border-left:3px solid var(--accent-l);border-radius:0 10px 10px 0;padding:11px 13px;margin-bottom:14px;font-size:13px;color:var(--t2);line-height:1.7">${a.contexte}</div>`;
  }

  if(Array.isArray(a.questions)){
    html+=`<div style="font-size:10px;font-weight:900;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;margin-top:4px">QUESTIONS</div>`;
    html+=a.questions.map((q,i)=>{
      let qhtml=`<div style="background:var(--bg-2);border:1px solid rgba(77,143,255,.1);border-radius:12px;padding:13px 14px;margin-bottom:8px">
        <div style="font-size:12px;font-weight:800;color:var(--accent-l);margin-bottom:6px">Question ${i+1}${q.pts?' ('+eh(q.pts)+')':''}</div>
        <div style="font-size:13px;color:var(--t1);line-height:1.65;margin-bottom:8px">${eh(q.q)}</div>`;
      if(q.corrige){
        qhtml+=`<details style="margin-top:8px"><summary style="font-size:11px;font-weight:700;color:var(--ok);cursor:pointer">Voir le corrigé</summary>
          <div style="font-size:12.5px;color:var(--t2);line-height:1.7;margin-top:8px;padding-top:8px;border-top:1px solid rgba(77,143,255,.1)">${q.corrige}</div>
        </details>`;
      }
      qhtml+=`</div>`;
      return qhtml;
    }).join('');
  }

  if(a.corrige_global){
    html+=`<div style="font-size:10px;font-weight:900;color:var(--ok);text-transform:uppercase;letter-spacing:.1em;margin:14px 0 8px">CORRIGÉ COMPLET</div>
      <div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:13px 14px;font-size:13px;color:var(--t2);line-height:1.7">${a.corrige_global}</div>`;
  }

  body.innerHTML=html;
  ov.style.display='flex';
  ov.scrollTop=0;
}

function closeAnnale(){
  const ov=document.getElementById('ann-ov');
  if(ov)ov.style.display='none';
  renderAnnalesList();
}

/* ═══ v25 — see third script block for patches ═══ */


/* ─── PRINT SHEETS ─── */
const PRINT_SHEETS=[
  {id:'ps1',title:'Classification tripartite & Tentative',emoji:'📊',sub:'Art. 111-1 CP · Art. 121-5 CP'},
  {id:'ps2',title:'GAV — Tous régimes comparés',emoji:'🔒',sub:'Art. 63, 706-88, 706-88-1 CPP'},
  {id:'ps3',title:'Cadres d\'enquête & Perquisitions',emoji:'🔍',sub:'Art. 53, 75, 151, 56, 76 CPP'},
  {id:'ps4',title:'Infractions principales — Méthode LAME',emoji:'⚖️',sub:'Homicide · Vol · Viol · Stups · Escroquerie'},
  {id:'ps5',title:'Mandats, CJ, ARSE, Détention provisoire',emoji:'⛓️',sub:'Art. 122-143 CPP'},
  {id:'pv1',title:'Canevas PV — Plainte & Témoignage',emoji:'📝',sub:'Art. 53 et s. CPP · Art. 10-2 CPP'},
  {id:'pv2',title:'Canevas PV — Interpellation + GAV',emoji:'🚔',sub:'Art. 63-1 à 63-4-3 CPP · Loi 22/04/2024'},
  {id:'pv3',title:'Canevas PV — Perquisition & Fouilles',emoji:'🔍',sub:'Art. 56/76 CPP · SDIACSS'},
  {id:'art1',title:'Ligne du Temps — ALPHA (20 actes FD)',emoji:'⏱️',sub:'Vol · Flagrant Délit complet'},
  {id:'lame',title:'Méthode LAME — Fiche Mémo Infraction',emoji:'⚖️',sub:'Légal · Actuel · Moral · Énrôlement'},
  {id:'bloc1',title:'Libertés Publiques & Acteurs PJ',emoji:'🏛️',sub:'DDHC 1789 · Art. 40 CPP · Acteurs PJ'},
  {id:'bloc2',title:'Fichiers Police & Réquisitions',emoji:'🗃️',sub:'TAJ · FNAEG · FAED · Art. 60/77-1 CPP'},
];
const PRINT_CONTENT={
ps1:`<h1>📊 Classification tripartite & Tentative</h1>
<h2>Tripartition des infractions (Art. 111-1 CP)</h2>
<div class="table-scroll"><table><tr><th>Nature</th><th>Peine</th><th>Juridiction</th><th>Prescription AP</th></tr>
<tr><td>CRIME</td><td>Réclusion criminelle / Perpétuité</td><td>Cour d'Assises</td><td>20 ans</td></tr>
<tr><td>DÉLIT</td><td>Emprisonnement + amende</td><td>Tribunal Correctionnel</td><td>6 ans</td></tr>
<tr><td>CONTRAVENTION</td><td>Amende ≤ 1 500 €</td><td>Tribunal de Police</td><td>1 an</td></tr></table></div>
<h2>Tentative (Art. 121-5 CP)</h2>
<p>Conditions : <strong>commencement d'exécution</strong> + <strong>désistement involontaire</strong></p>
<p>Crime → toujours punissable. Délit → si texte exprès. Contravention → JAMAIS.</p>
<div class="piege-box">⚠️ Piège : La tentative de contravention N'EST PAS punissable. La tentative d'un délit doit être expressément prévue par le texte.</div>
<h2>Récidive légale (Art. 132-8 CP)</h2>
<div class="table-scroll"><table><tr><th>Type</th><th>Délai</th><th>Effet</th></tr>
<tr><td>Crime / Crime</td><td>Perpétuel</td><td>Doublement de la peine max</td></tr>
<tr><td>Délit / Délit assimilé</td><td>5 ans</td><td>Doublement de la peine max</td></tr>
<tr><td>Contravention 5e classe</td><td>1 an</td><td>Alourdissement</td></tr></table></div>`,

ps2:`<h1>🔒 GAV — Tous régimes</h1>
<div class="table-scroll"><table><tr><th>Régime</th><th>Initiale</th><th>Max total</th><th>Prolongation</th></tr>
<tr><td>Droit commun (art. 63)</td><td>24h</td><td>48h</td><td>PR — écrit + motivé</td></tr>
<tr><td>Criminalité organisée (706-88)</td><td>24h</td><td>96h</td><td>PR puis JLD (>48h)</td></tr>
<tr><td>Terrorisme (706-88-1)</td><td>24h</td><td>144h</td><td>PR puis JLD (>48h)</td></tr>
<tr><td>Mineur 13-16 ans</td><td>24h</td><td>48h max</td><td>PR (ou JLD si CO)</td></tr></table></div>
<h2>Droits notifiés IMMÉDIATEMENT (Art. 63-1 CPP)</h2>
<p>Droit au silence · Avocat SANS délai (loi 22/04/2024) · Examen médical · Aviser un proche · Interprète</p>
<div class="piege-box">⚠️ Pièges : (1) Heure de GAV = heure d'APPRÉHENSION, pas d'arrivée au commissariat. (2) Délai de carence avocat SUPPRIMÉ depuis le 22/04/2024. (3) Avis PR = IMMÉDIAT. (4) Mineur <16 ans : examen médical OBLIGATOIRE ET IMMÉDIAT.</div>`,

ps3:`<h1>🔍 Cadres d'enquête & Perquisitions</h1>
<h2>Les 5 cadres d'enquête</h2>
<div class="table-scroll"><table><tr><th>Cadre</th><th>Article</th><th>Durée</th><th>Pouvoirs</th></tr>
<tr><td>Flagrance</td><td>Art. 53 CPP</td><td>8j + 8j (JLD)</td><td>Contrainte immédiate</td></tr>
<tr><td>Préliminaire</td><td>Art. 75 CPP</td><td>2 ans + 1 an</td><td>Consentement ou JLD</td></tr>
<tr><td>Commission rogatoire</td><td>Art. 151 CPP</td><td>Limitée par CR</td><td>Identiques à flagrance</td></tr>
<tr><td>Art. 74 (mort suspecte)</td><td>Art. 74 CPP</td><td>—</td><td>Avant qualification pénale</td></tr>
<tr><td>Art. 74-1 (disparition)</td><td>Art. 74-1 CPP</td><td>—</td><td>3 critères cumulatifs</td></tr></table></div>
<h2>Règles de perquisition</h2>
<div class="table-scroll"><table><tr><th>Cadre</th><th>Accord requis</th><th>Horaires</th><th>Particularités</th></tr>
<tr><td>Flagrance</td><td>NON</td><td>24h/24</td><td>Art. 56 CPP</td></tr>
<tr><td>Préliminaire</td><td>OUI (écrit) ou JLD</td><td>6h–21h</td><td>Art. 76 CPP</td></tr>
<tr><td>CR</td><td>NON</td><td>24h/24</td><td>Art. 94-96 CPP</td></tr></table></div>
<p><strong>Lieux protégés :</strong> Avocat → bâtonnier OBLIGATOIRE | Médecin → président ordre | Presse → magistrat</p>`,

ps4:`<h1>⚖️ Infractions principales — Méthode LAME</h1>
<div class="table-scroll"><table><tr><th>Infraction</th><th>Article</th><th>Qual.</th><th>Peine de base</th><th>Élément moral</th></tr>
<tr><td>MEURTRE</td><td>221-1 CP</td><td>Crime</td><td>30 ans RC</td><td>Intention de tuer (animus necandi)</td></tr>
<tr><td>ASSASSINAT</td><td>221-3 CP</td><td>Crime</td><td>Perpétuité</td><td>Préméditation + intention de tuer</td></tr>
<tr><td>VIOL</td><td>222-23 CP</td><td>Crime</td><td>15 ans RC</td><td>Intentionnel, sans consentement</td></tr>
<tr><td>VOL SIMPLE</td><td>311-1 CP</td><td>Délit</td><td>3 ans / 45k€</td><td>Intention de se comporter en propriétaire</td></tr>
<tr><td>VOL BANDE ORG.</td><td>311-9 CP</td><td>Crime</td><td>15 ans RC</td><td>Intentionnel + organisation</td></tr>
<tr><td>ESCROQUERIE</td><td>313-1 CP</td><td>Délit</td><td>5 ans / 375k€</td><td>Tromperie → remise</td></tr>
<tr><td>ABUS DE CONFIANCE</td><td>314-1 CP</td><td>Délit</td><td>3 ans / 375k€</td><td>Remise préalable licite + détournement</td></tr>
<tr><td>RECEL</td><td>321-1 CP</td><td>Délit</td><td>5 ans / 375k€</td><td>Connaissance origine frauduleuse</td></tr>
<tr><td>USAGE STUPS</td><td>L3421-1 CSP</td><td>Délit</td><td>1 an / 3 750€</td><td>Intentionnel</td></tr>
<tr><td>BLANCHIMENT</td><td>324-1 CP</td><td>Délit</td><td>5 ans / 375k€</td><td>Connaissance origine criminelle</td></tr></table></div>`,

ps5:`<h1>⛓️ Mandats, CJ, ARSE, Détention Provisoire</h1>
<h2>Les 4 mandats + mandat de recherche</h2>
<div class="table-scroll"><table><tr><th>Mandat</th><th>Article</th><th>Auteur</th><th>Effet</th></tr>
<tr><td>Comparution</td><td>122 al.1 CPP</td><td>JI</td><td>Se présenter volontairement</td></tr>
<tr><td>Amener</td><td>122 al.2 CPP</td><td>JI</td><td>Conduire de force — pas d'incarcération</td></tr>
<tr><td>Dépôt</td><td>122 al.3 CPP</td><td>JI</td><td>Incarcération immédiate</td></tr>
<tr><td>Arrêt</td><td>131 CPP</td><td>JI</td><td>Fugitifs/étranger — arrestation + prison</td></tr>
<tr><td>Recherche</td><td>122-4 CPP</td><td>PR</td><td>Interpellation — délits ≥3 ans — 1 an renouv.</td></tr></table></div>
<h2>Tableau comparatif CJ / ARSE / DP</h2>
<div class="table-scroll"><table><tr><th>Mesure</th><th>Article</th><th>Seuil peine</th><th>Décideur</th><th>Durée</th></tr>
<tr><td>Contrôle Judiciaire</td><td>138 CPP</td><td>Tout emprisonnement</td><td>JLD</td><td>Sans limite légale</td></tr>
<tr><td>ARSE</td><td>142-5 CPP</td><td>≥ 2 ans</td><td>JLD</td><td>Même régime DP</td></tr>
<tr><td>Détention Provisoire</td><td>143-1 CPP</td><td>≥ 3 ans</td><td>JLD</td><td>4 mois → 2 ans max (correctionnel)</td></tr></table></div>
<div class="piege-box">⚠️ Piège fondamental : Le JI seul NE PEUT JAMAIS décider la DP. C'est TOUJOURS le JLD, saisi par ordonnance du JI avec réquisitions du PR.</div>`,
pv1:`<h1>📝 Canevas PV — Plainte &amp; Témoignage</h1>
<h2>SAISINE — PLAINTE (Art. 53 et s. CPP · Art. 10-2 CPP)</h2>
<div class="cartouche"><div class="cartouche-title">Structure du cartouche plainte</div>
<div class="table-scroll"><table>
<tr><th>Rubrique</th><th>Contenu obligatoire</th></tr>
<tr><td><strong>En-tête</strong></td><td>Étant au service — date, heure, lieu de rédaction</td></tr>
<tr><td><strong>Saisine</strong></td><td>Constatons que se présente NOM Prénom victime du fait de [infraction]</td></tr>
<tr><td><strong>Cadre juridique</strong></td><td>Agissant en flagrant délit — Vu les articles 53 et s. CPP</td></tr>
<tr><td><strong>Droits Art. 10-2</strong></td><td>Information des droits de la victime — Formulaire remis</td></tr>
<tr><td><strong>Identité victime</strong></td><td>NOM, prénom, DOB, lieu naissance, adresse, nationalité, profession</td></tr>
<tr><td><strong>Déclaration des faits</strong></td><td>Description précise, préjudice, capacité à reconnaître l'auteur</td></tr>
<tr><td><strong>Avis Parquet</strong></td><td>Avisons immédiatement M. le Procureur de la République (Art. 40 CPP)</td></tr>
<tr><td><strong>Clôture</strong></td><td>Plainte contre X ou personne dénommée — Récépissé remis de droit</td></tr>
<tr><td><strong>Signature</strong></td><td>Après lecture, NOM Prénom signe avec nous le présent PV</td></tr>
</table></div></div>
<h2>SAISINE — TÉMOIGNAGE (Art. 53 et s. CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Élément</th><th>Formule type</th></tr>
<tr><td>Saisine</td><td>Sommes requis par [identité] qui déclare avoir été témoin de [fait]</td></tr>
<tr><td>Cadre</td><td>Agissant en flagrant délit — Vu les articles 53 et s. CPP</td></tr>
<tr><td>Identité</td><td>L'invitons à nous décliner son identité : NOM Prénom, DOB, adresse</td></tr>
<tr><td>Q/R</td><td>QUESTION : … / RÉPONSE : … (autant que nécessaire)</td></tr>
<tr><td>Signature</td><td>Après lecture, signe avec nous le présent PV</td></tr>
</table></div>
<h2>SAISINE — TRANSPORT / CONSTATATIONS</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule type</th></tr>
<tr><td>Départ</td><td>Étant au service — Sommes requis par [mode saisine] du fait de [infraction]</td></tr>
<tr><td>SDPTS</td><td>Sollicitons le SDPTS aux fins de relevé de traces ou indices</td></tr>
<tr><td>Transport</td><td>Assisté des GP … nous transportons à [adresse] — Où étant à [heure]</td></tr>
<tr><td>Constatations</td><td><strong>En présence constante et effective du SDPTS</strong> — constatons extérieur, progression, éléments</td></tr>
<tr><td>Résultat PTS</td><td>Le SDPTS indique n'avoir relevé aucune trace / ou description des traces</td></tr>
<tr><td>Clôture</td><td>Dont PV que nos assistants signent avec nous</td></tr>
</table></div>
<div class="ok"><strong>✓ Avis Parquet obligatoire :</strong> Art. 40 CPP — dès la constatation d'un crime ou délit. Le récépissé est de droit à la demande de la victime (Art. 10-2 CPP).</div>
<div class="piege"><strong>⚠️ Pièges :</strong> Toujours mentionner la <u>présence constante et effective</u> du SDPTS. L'heure de GAV = heure d'appréhension, jamais l'heure d'arrivée au service.</div>`,
pv2:`<h1>🚔 Canevas PV — Interpellation &amp; Garde à Vue</h1>
<h2>INTERPELLATION (Art. 53 et s. CPP · Art. 803 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule obligatoire</th><th>Article</th></tr>
<tr><td>Constat</td><td>Constatons [fait + signalement] — Agissant en flagrant délit</td><td>Art. 53 CPP</td></tr>
<tr><td>Interpellation</td><td>Interpellons l'individu à [heure] au [lieu]</td><td>Art. 53 CPP</td></tr>
<tr><td>Menottage</td><td>Conformément à l'Art. 803 CPP — Menottons car [justification : fuite/danger/résistance]</td><td>Art. 803 CPP</td></tr>
<tr><td>Palpation</td><td>Palpé par mesure de sécurité par le GP : positif [objet] / négatif</td><td>Mesure sécurité</td></tr>
<tr><td>Identité</td><td>L'invitons à nous décliner son identité : il nous déclare se nommer…</td><td>—</td></tr>
<tr><td>Notification verbale GAV</td><td>L'informons qu'il est placé en GAV à compter de [heure] d'interpellation pour [qualification]</td><td>Art. 63-1 CPP</td></tr>
<tr><td>Droits verbaux</td><td>L'informons immédiatement de ses droits Art. 63-1 à 63-4-3 — PV séparé à suivre</td><td>Art. 63-1 à 63-4-3</td></tr>
</table></div>
<h2>NOTIFICATION PLACEMENT EN GAV — MAJEUR (Art. 63-1 CPP)</h2>
<div class="cartouche"><div class="cartouche-title">Éléments obligatoires du cartouche GAV</div>
<ul>
<li><strong>À compter du</strong> [date] à [heure] de l'interpellation</li>
<li><strong>Pour les faits</strong> de [qualification] commis le [date] à [ville]</li>
<li><strong>Motif du [1° à 6°] de l'Art. 62-2 CPP</strong> — la GAV est l'unique moyen de…</li>
<li><strong>Durée maximale :</strong> 24H + 24H possible sur accord du Parquet</li>
<li>Notification droits : silence, interprète, avis proche/avocat/autorités consulaires, médecin, pièces, observations</li>
<li>Remise du <strong>formulaire de déclaration des droits</strong></li>
</ul></div>
<h2>LES 6 OBJECTIFS DE LA GAV (Art. 62-2 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>N°</th><th>Objectif — La GAV doit être l'UNIQUE moyen de…</th></tr>
<tr><td>1°</td><td>Permettre les investigations impliquant la présence/participation de la personne</td></tr>
<tr><td>2°</td><td>Garantir la présentation devant le Procureur de la République</td></tr>
<tr><td>3°</td><td>Empêcher la modification des preuves ou indices matériels</td></tr>
<tr><td>4°</td><td>Empêcher les pressions sur témoins, victimes, proches</td></tr>
<tr><td>5°</td><td>Empêcher la concertation avec coauteurs ou complices</td></tr>
<tr><td>6°</td><td>Garantir la mise en œuvre des mesures pour faire cesser le crime/délit</td></tr>
</table></div>
<h2>DROITS EN GAV (Art. 63-1 à 63-4-3 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Droit</th><th>Article</th><th>Délai / Note</th></tr>
<tr><td>Droit au silence</td><td>Art. 63-1</td><td>Immédiat — pas d'obligation de répondre</td></tr>
<tr><td>Interprète gratuit</td><td>Art. 63-1</td><td>Immédiat si ne comprend pas le français</td></tr>
<tr><td>Avis proche/employeur</td><td>Art. 63-2</td><td>Dès la 1ère heure — sans délai</td></tr>
<tr><td>Avocat + entretien 30 min</td><td>Art. 63-3-1</td><td><strong>Sans délai de carence — Loi 22/04/2024</strong></td></tr>
<tr><td>Médecin</td><td>Art. 63-3</td><td>À tout moment</td></tr>
<tr><td>Consulter pièces</td><td>Art. 63-4-1</td><td>À tout moment</td></tr>
<tr><td>Présenter observations</td><td>Art. 63-4-2</td><td>Au magistrat</td></tr>
</table></div>
<h2>DURÉES DE GAV</h2>
<div class="table-scroll"><table>
<tr><th>Profil</th><th>Initiale</th><th>Prolongation</th><th>CDO (Art. 706-88)</th></tr>
<tr><td>Majeur droit commun</td><td>24H</td><td>+24H (accord Parquet)</td><td>+48H +48H</td></tr>
<tr><td>Mineur 13-16 ans</td><td>24H</td><td>+24H séparé majeurs</td><td>Régime CJPM</td></tr>
<tr><td>Mineur 16-18 ans</td><td>24H</td><td>+24H séparé majeurs</td><td>Régime CJPM</td></tr>
<tr><td>Retenue 10-13 ans</td><td>12H</td><td>—</td><td>Infraction ≥ 5 ans emp.</td></tr>
</table></div>
<div class="warn"><strong>⚡ Loi 22 avril 2024 :</strong> Délai de carence avocat <strong>supprimé</strong>. L'avocat intervient dès le début de la GAV.</div>
<div class="piege"><strong>⚠️ Pièges :</strong> (1) Seul l'OPJ peut placer en GAV. (2) La GAV doit être l'<u>unique</u> moyen. (3) Heure GAV = heure interpellation, pas d'arrivée au service.</div>`,
pv3:`<h1>🔍 Canevas PV — Perquisition &amp; Fouilles</h1>
<h2>PERQUISITION — FLAGRANT DÉLIT (Art. 56 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule type</th></tr>
<tr><td>Transport</td><td>Muni des clés extraites de sa fouille — En compagnie du nommé, nous transportons à [adresse]</td></tr>
<tr><td>Constat extérieur</td><td>Constatons qu'il s'agit de [description extérieure des lieux]</td></tr>
<tr><td>Entrée</td><td>À [heure], à l'aide des clés, pénétrons dans les lieux</td></tr>
<tr><td>Perquisition</td><td><strong>En la présence constante et effective</strong> du nommé — procédons à minutieuse perquisition — Description des pièces</td></tr>
<tr><td>Découverte</td><td>Dans [localisation], sous/sur [meuble], découvrons [élément] — Description précise</td></tr>
<tr><td>Interrogation</td><td>Interpellé sur l'origine, le nommé nous déclare :</td></tr>
<tr><td>Saisie</td><td>Saisissons et plaçons sous <strong>scellé n° UN</strong> : [description complète]</td></tr>
<tr><td>Fin</td><td>Perquisition terminée à [heure] sans incident — aucun autre élément</td></tr>
<tr><td>Clôture</td><td>Refermons les lieux — Clés replaçons dans les effets du nommé</td></tr>
<tr><td>Signature</td><td>Après lecture, le nommé signe avec nous et nos assistants ainsi que la fiche de scellé</td></tr>
</table></div>
<div class="warn"><strong>⚠️ Heures légales :</strong> 6H – 21H en tout lieu. Sauf crime ou FD chez la personne interpellée = 24H/24.</div>
<h2>PERQUISITION — ENQUÊTE PRÉLIMINAIRE (Art. 76 CPP)</h2>
<div class="cartouche"><div class="cartouche-title">Différence clé avec FD</div>
<ul>
<li>Nécessite l'<strong>assentiment exprès et manuscrit</strong> de la personne</li>
<li>En cas de refus ET crime ou délit puni d'au moins 5 ans d'emprisonnement : requête Parquet → autorisation JLD (écrite et motivée) — Art. 76 al. 4 CPP</li>
<li>Mêmes heures légales : 6H – 21H</li>
</ul></div>
<h2>FOUILLE INTÉGRALE (Art. 53 et s. CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule</th></tr>
<tr><td>Nécessité</td><td>Susceptible de détenir [élément] non détectable par palpation</td></tr>
<tr><td>Exécution</td><td>Procédons à fouille intégrale sur la personne de NOM Prénom</td></tr>
<tr><td>Découverte</td><td>Dans [endroit], découvrons [élément] — description précise</td></tr>
<tr><td>Saisie</td><td>Saisissons et plaçons sous scellé n° [numéro]</td></tr>
<tr><td>Fin</td><td>Fouille terminée, ne nous permet de découvrir aucun autre élément</td></tr>
</table></div>
<h2>FOUILLE VÉHICULE (Art. 53 et s. CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule</th></tr>
<tr><td>Constat</td><td>Constatons présence du véhicule [marque, modèle, immat.], stationné</td></tr>
<tr><td>Ouverture</td><td>À l'aide des clés : portières, capot, coffre</td></tr>
<tr><td>Fouille</td><td><strong>En présence constante et effective</strong> du nommé — minutieuse fouille</td></tr>
<tr><td>Saisie</td><td>Saisissons et plaçons sous scellé n° [numéro]</td></tr>
<tr><td>Clôture</td><td>Refermons le véhicule — clés replacées dans effets du nommé</td></tr>
</table></div>
<h2>MÉTHODE SDIACSS — Saisie Incidente</h2>
<div class="table-scroll"><table>
<tr><th>Lettre</th><th>Action</th></tr>
<tr><td><strong>S</strong> — Situation</td><td>Contexte de la découverte incidente</td></tr>
<tr><td><strong>D</strong> — Description</td><td>Description précise de l'objet saisi</td></tr>
<tr><td><strong>I</strong> — Interpellation</td><td>Question à l'intéressé sur l'origine</td></tr>
<tr><td><strong>A</strong> — Avis Parquet</td><td>Avis immédiat obligatoire</td></tr>
<tr><td><strong>C</strong> — Cadre juridique</td><td>FD ou procédure incidente</td></tr>
<tr><td><strong>S</strong> — Saisie</td><td>Saisie formalisée dans le PV</td></tr>
<tr><td><strong>S</strong> — Scellé</td><td>Constitution du scellé numéroté</td></tr>
</table></div>
<div class="piege"><strong>⚠️ Saisie incidente :</strong> Objet rattaché infraction en FD = avis Parquet immédiat + ouverture nouvelle procédure + extension GAV aux nouveaux faits.</div>`,
art1:`<h1>⏱️ Ligne du Temps — Enquête ALPHA (Flagrant Délit)</h1>
<p><em>Scénario type : Vol dans local d'habitation — 10h30 — Flagrant Délit complet</em></p>
<h2>Chronologie des 20 actes</h2>
<div class="timeline-item"><div class="tl-num">01</div><div class="tl-time">10h30</div><div class="tl-title"><strong>SAISINE — PLAINTE C/X</strong><br><small>Victime — Art. 10-2 CPP — Droits — Avis Parquet + hiérarchie</small></div></div>
<div class="timeline-item"><div class="tl-num">02</div><div class="tl-time">11h00</div><div class="tl-title"><strong>PRÉSENTATION PHOTOS TAJ à victime</strong><br><small>Fichier TAJ — Présentation formalisée</small></div></div>
<div class="timeline-item"><div class="tl-num">03</div><div class="tl-time">11h10</div><div class="tl-title"><strong>IDENTIFICATION suspect</strong><br><small>Suite présentation TAJ</small></div></div>
<div class="timeline-item"><div class="tl-num">04</div><div class="tl-time">11h20</div><div class="tl-title"><strong>RECHERCHES FICHIERS</strong><br><small>TAJ, FPR, FNAEG, FAED, SNPC, FOVES…</small></div></div>
<div class="timeline-item"><div class="tl-num">05</div><div class="tl-time">11h40</div><div class="tl-title"><strong>VÉRIFICATION DE DOMICILE (VD)</strong><br><small>Vérification préalable adresse suspect</small></div></div>
<div class="timeline-item"><div class="tl-num">06</div><div class="tl-time">12h00</div><div class="tl-title"><strong>TRANSPORT / CONSTATATIONS</strong><br><small>SDPTS + Vidéoprotection + Album photo</small></div></div>
<div class="timeline-item"><div class="tl-num">07</div><div class="tl-time">12h20</div><div class="tl-title"><strong>ENQUÊTE DE VOISINAGE (EV)</strong><br><small>Gardiens X et Y — Résultat</small></div></div>
<div class="timeline-item"><div class="tl-num" style="background:var(--err)">08</div><div class="tl-time">13h15</div><div class="tl-title"><strong>TRANSPORT / INTERPELLATION ← DÉBUT GAV</strong><br><small>Menottage Art. 803 — Palpation — Notification verbale GAV</small></div></div>
<div class="timeline-item"><div class="tl-num">09</div><div class="tl-time">13h20</div><div class="tl-title"><strong>NOTIFICATION PLACEMENT EN GAV (PV séparé)</strong><br><small>6 objectifs Art. 62-2 — Droits Art. 63-1 à 63-4-3 — Formulaire remis</small></div></div>
<div class="timeline-item"><div class="tl-num">10</div><div class="tl-time">13h30</div><div class="tl-title"><strong>AVIS PARQUET</strong><br><small>Obligatoire dès placement en GAV</small></div></div>
<div class="timeline-item"><div class="tl-num">11</div><div class="tl-time">13h35</div><div class="tl-title"><strong>FOUILLE INTÉGRALE</strong><br><small>Nécessité justifiée — Résultat + scellé ou négatif</small></div></div>
<div class="timeline-item"><div class="tl-num">12</div><div class="tl-time">14h00</div><div class="tl-title"><strong>PERQUISITION domicile suspect</strong><br><small>Présence constante du MEC — Saisie + scellé n° DEUX</small></div></div>
<div class="timeline-item"><div class="tl-num">13</div><div class="tl-time">15h30</div><div class="tl-title"><strong>ENTRETIEN AVOCAT</strong><br><small>30 min — Sans délai de carence (Loi 22/04/2024)</small></div></div>
<div class="timeline-item"><div class="tl-num">14</div><div class="tl-time">16h00</div><div class="tl-title"><strong>CONSTITUTION DE GROUPE</strong><br><small>Pour présentation aux témoins/victimes</small></div></div>
<div class="timeline-item"><div class="tl-num">15</div><div class="tl-time">16h30</div><div class="tl-title"><strong>PRÉSENTATION DE GROUPE</strong><br><small>En présence de l'avocat</small></div></div>
<div class="timeline-item"><div class="tl-num">16</div><div class="tl-time">17h00</div><div class="tl-title"><strong>PLAINTE C/ MEC dénommé</strong><br><small>Plainte victime contre suspect identifié</small></div></div>
<div class="timeline-item"><div class="tl-num">17</div><div class="tl-time">17h30</div><div class="tl-title"><strong>AUDITION MEC (gardé à vue)</strong><br><small>En présence avocat — Droits rappelés</small></div></div>
<div class="timeline-item"><div class="tl-num">18</div><div class="tl-time">18h30</div><div class="tl-title"><strong>COMPTE-RENDU PARQUET</strong><br><small>Instructions substitut — COPJ / Défèrement / Classement</small></div></div>
<div class="timeline-item"><div class="tl-num">19</div><div class="tl-time">18h45</div><div class="tl-title"><strong>SIGNALISATION GÉNÉTIQUE</strong><br><small>Art. 706-55 CPP — Prélèvement buccal — FNAEG</small></div></div>
<div class="timeline-item"><div class="tl-num" style="background:var(--ok)">20</div><div class="tl-time">19h00</div><div class="tl-title"><strong>NOTIFICATION FIN GAV ET SUITES</strong><br><small>Droits rappelés — COPJ ou défèrement — Signature</small></div></div>
<div class="ok"><strong>✓ Règle d'or :</strong> Chaque acte = un PV distinct avec cartouche. Les heures doivent être chronologiques et cohérentes. GAV = acte 08 (interpellation), jamais l'arrivée au service.</div>
<div class="piege"><strong>⚠️ Pièges ALPHA :</strong> (1) Heure GAV débute à l'interpellation. (2) Avocat sans délai depuis loi 22/04/2024. (3) Plainte dénommé uniquement après identification formelle. (4) Signalisation génétique = Art. 706-55 CPP.</div>`,
lame:`<h1>⚖️ Méthode LAME — Fiche Mémo Infraction</h1>
<p>La méthode <strong>LAME</strong> structure l'analyse de toute infraction en 4 éléments constitutifs obligatoires.</p>
<h2>L — Élément Légal</h2>
<div class="table-scroll"><table>
<tr><th>Composante</th><th>Contenu</th></tr>
<tr><td>Article de définition</td><td>Article XX CP/CPP qui prévoit et définit l'infraction</td></tr>
<tr><td>Article de répression</td><td>Article XX qui fixe la peine (emprisonnement + amende)</td></tr>
<tr><td>Circonstances aggravantes</td><td>Articles des aggravations (effraction, récidive, bande organisée…)</td></tr>
<tr><td>Classification (Art. 111-1 CP)</td><td>Crime / Délit / Contravention</td></tr>
</table></div>
<h2>A — Élément Actuel / Matériel</h2>
<div class="table-scroll"><table>
<tr><th>Aspect</th><th>Contenu</th></tr>
<tr><td>Faits constatés</td><td>Tous éléments objectifs prouvant la matérialité de l'infraction</td></tr>
<tr><td>Nature des actes</td><td>Unique ou pluralité — Instantané ou continu dans le temps</td></tr>
<tr><td>Commission ou omission</td><td>Action active ou inaction contraire à l'ordre social</td></tr>
<tr><td>Preuves matérielles</td><td>Scellés, témoignages, constatations, rapports PTS</td></tr>
</table></div>
<h2>M — Élément Moral (Culpabilité)</h2>
<div class="table-scroll"><table>
<tr><th>Type de faute</th><th>Définition</th><th>Exemples</th></tr>
<tr><td><strong>Dol général</strong></td><td>Conscience + volonté d'accomplir l'acte</td><td>Vol, meurtre, coups</td></tr>
<tr><td><strong>Intentionnelle</strong></td><td>Volonté dirigée vers le résultat précis</td><td>Homicide volontaire</td></tr>
<tr><td><strong>Non-intentionnelle</strong></td><td>Imprudence, négligence, maladresse</td><td>Homicide par imprudence</td></tr>
<tr><td><strong>Mise en danger délibérée</strong></td><td>Violation manifestement délibérée obligation sécurité</td><td>Art. 223-1 CP</td></tr>
<tr><td><strong>Contraventionnelle</strong></td><td>Simple matérialité, sans intention requise</td><td>Infractions routières</td></tr>
</table></div>
<p style="font-size:11px;font-style:italic">Formule type démontrant la conscience : « L'intéressé, en état de conscience pleine et entière, a volontairement… »</p>
<h2>E — Énrôlement / Responsabilité Pénale</h2>
<div class="table-scroll"><table>
<tr><th>Situation</th><th>Formule</th></tr>
<tr><td>Responsabilité pleine</td><td>NOM Prénom engage sa responsabilité pénale pleine et entière</td></tr>
<tr><td>Irresponsabilité</td><td>Ne peut donner lieu à poursuites — motif : trouble mental, contrainte, minorité</td></tr>
<tr><td>Tentative (Art. 121-5)</td><td>Commencement exécution + absence désistement volontaire</td></tr>
<tr><td>Complicité (Art. 121-7)</td><td>Fait principal punissable + participation + intention de participer</td></tr>
<tr><td>Immunité familiale</td><td>Au préjudice ascendant/descendant/conjoint (hors documents indispensables)</td></tr>
</table></div>
<h2>Tripartition des Infractions (Art. 111-1 CP)</h2>
<div class="table-scroll"><table>
<tr><th>Nature</th><th>Peine max</th><th>Juridiction</th><th>Prescription AP</th><th>Prescription peine</th></tr>
<tr><td><strong>CRIME</strong></td><td>Réclusion / Perpétuité</td><td>Cour d'Assises</td><td>20 ans</td><td>20 ans</td></tr>
<tr><td><strong>DÉLIT</strong></td><td>Emprisonnement + amende</td><td>Tribunal Correctionnel</td><td>6 ans</td><td>6 ans</td></tr>
<tr><td><strong>CONTRAVENTION</strong></td><td>Amende (R, C1 à C5)</td><td>Tribunal de Police</td><td>1 an</td><td>3 ans</td></tr>
</table></div>
<div class="piege"><strong>⚠️ La classification détermine :</strong> Régime de GAV · Durée de prescription · Juridiction compétente · Quantum de peine. Une erreur de qualification peut faire tomber toute la procédure.</div>`,
bloc1:`<h1>🏛️ Libertés Publiques &amp; Acteurs de la PJ</h1>
<h2>Libertés Fondamentales</h2>
<div class="table-scroll"><table>
<tr><th>Liberté</th><th>Définition</th><th>Base juridique</th></tr>
<tr><td><strong>La Sûreté</strong></td><td>Droit de n'être ni arrêté ni détenu arbitrairement</td><td>DDHC 1789</td></tr>
<tr><td><strong>Aller et venir</strong></td><td>Droit de se déplacer librement, pas d'arrestation hors cadre légal</td><td>Préambule Const. 1958</td></tr>
</table></div>
<h2>Mesures de Privation de Liberté</h2>
<div class="table-scroll"><table>
<tr><th>Mesure</th><th>Article</th><th>Durée max</th><th>Notes</th></tr>
<tr><td>Garde à vue</td><td>Art. 62-2 CPP</td><td>24H + 24H (CDO +48H+48H)</td><td>Seul l'OPJ peut placer</td></tr>
<tr><td>Contrôle d'identité</td><td>Art. 78-2 CPP</td><td>Temps nécessaire</td><td>OPJ, APJ, APJA</td></tr>
<tr><td>Vérification d'identité</td><td>Art. 78-3 CPP</td><td>4H maximum</td><td>Sur décision OPJ</td></tr>
<tr><td>Relevé d'identité</td><td>Art. 78-6 CPP</td><td>—</td><td>Contravention seulement</td></tr>
</table></div>
<h2>Vérification d'Identité — Procédure (Art. 78-3 CPP)</h2>
<div class="cartouche"><div class="cartouche-title">Procédure stricte</div>
<ul>
<li>Recherche <strong>coercitive</strong> sur décision de l'OPJ</li>
<li><strong>4H maximum</strong> — strictement nécessaire à découvrir l'identité véritable</li>
<li>Causes : contrôle d'identité, relevé d'identité, recueil d'identité → la personne refuse ou ne peut justifier</li>
<li>Avis à toute personne de son choix + avis au Procureur de la République</li>
<li>Fin : destruction empreintes FAED dans les 6 mois</li>
</ul></div>
<h2>Les Acteurs de la Police Judiciaire (Art. 15 à 21 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Acteur</th><th>Rôle principal</th></tr>
<tr><td>Procureur de la République</td><td>Dirige et contrôle l'enquête de police judiciaire — Décide des poursuites</td></tr>
<tr><td>OPJ</td><td>Direction effective des enquêtes — GAV — Perquisitions — Chef d'enquête</td></tr>
<tr><td>APJ</td><td>Sous direction OPJ — Constatations, auditions déléguées</td></tr>
<tr><td>APJA</td><td>Actes très limités — recueil identité, constatations simples</td></tr>
<tr><td>Juge d'Instruction</td><td>Instruction judiciaire — Mandats — Commission rogatoire</td></tr>
<tr><td>Maires et adjoints</td><td>OPJ de droit dans certaines matières</td></tr>
</table></div>
<h2>Contrôle de la PJ</h2>
<div class="table-scroll"><table>
<tr><th>Instance</th><th>Type de contrôle</th></tr>
<tr><td>PG près la Cour d'Appel</td><td>Contrôle hiérarchique des OPJ du ressort</td></tr>
<tr><td>Inspection Générale de la Justice</td><td>Contrôle disciplinaire</td></tr>
<tr><td>Chambre de l'instruction</td><td>Contrôle juridictionnel des actes d'enquête (nullités)</td></tr>
</table></div>
<h2>Suites Possibles à l'Enquête</h2>
<div class="table-scroll"><table>
<tr><th>Décision du PR</th><th>Mode</th></tr>
<tr><td>Engagement des poursuites</td><td>COPJ, CPPV, CRPC, CI (Comparution Immédiate)</td></tr>
<tr><td>Alternative aux poursuites</td><td>Rappel à la loi, médiation, stage, réparation, composition pénale</td></tr>
<tr><td>Classement sans suite</td><td>Infraction non constituée ou inopportunité — recours possible PG</td></tr>
</table></div>
<div class="ok"><strong>Avis Parquet — 4 moments obligatoires (Art. 40 CPP) :</strong> (1) Constatation infraction · (2) Privation de liberté · (3) Demande prolongation GAV · (4) Fin de GAV</div>`,
bloc2:`<h1>🗃️ Fichiers Police &amp; Réquisitions</h1>
<h2>Fichiers liés aux Personnes</h2>
<div class="table-scroll"><table>
<tr><th>Sigle</th><th>Nom complet</th><th>Contenu clé</th></tr>
<tr><td><strong>TAJ</strong></td><td>Traitement des Antécédents Judiciaires</td><td>Mises en cause, victimes, témoins — Art. 230-6 CPP</td></tr>
<tr><td><strong>FPR</strong></td><td>Fichier des Personnes Recherchées</td><td>Personnes sous mandat, fugitifs, disparitions</td></tr>
<tr><td><strong>FNAEG</strong></td><td>Fichier National Empreintes Génétiques</td><td>Profils ADN — Art. 706-55 CPP — <strong>Réquisition permanente</strong></td></tr>
<tr><td><strong>FAED</strong></td><td>Fichier Automatisé Empreintes Digitales</td><td>Empreintes digitales/palmaires — <strong>Réquisition permanente</strong></td></tr>
<tr><td><strong>FIJAISV</strong></td><td>Fichier Judiciaire Auteurs Infr. Sexuelles/Violentes</td><td>Condamnés ISV — Obligations de pointage</td></tr>
<tr><td><strong>FIJAIT</strong></td><td>Fichier Judiciaire Auteurs Infr. Terroristes</td><td>Condamnés pour terrorisme</td></tr>
</table></div>
<h2>Fichiers liés aux Véhicules</h2>
<div class="table-scroll"><table>
<tr><th>Sigle</th><th>Nom</th><th>Usage</th></tr>
<tr><td><strong>FOVES</strong></td><td>Fichier Objets Véhicules Signalés</td><td>Véhicules volés, objets signalés</td></tr>
<tr><td><strong>SNPC</strong></td><td>Système National Permis de Conduire</td><td>Validité permis, solde de points</td></tr>
<tr><td><strong>SIV</strong></td><td>Système d'Immatriculation des Véhicules</td><td>Identification propriétaire</td></tr>
<tr><td><strong>FVA</strong></td><td>Fichier Véhicules Assurés</td><td>Vérification assurance</td></tr>
<tr><td><strong>EUCARIS</strong></td><td>Système européen d'immatriculation</td><td>Véhicules étrangers</td></tr>
<tr><td><strong>ADOC</strong></td><td>Accès Dossier Contraventions</td><td>Historique infractions routières</td></tr>
</table></div>
<h2>Les Réquisitions — Cadre Juridique</h2>
<div class="table-scroll"><table>
<tr><th>Cadre</th><th>Article</th><th>Autorité requérante</th><th>Spécificité</th></tr>
<tr><td>Flagrant délit</td><td>Art. 60 CPP</td><td>OPJ directement</td><td>Pas d'autorisation préalable</td></tr>
<tr><td>Enquête préliminaire</td><td>Art. 77-1 CPP</td><td>Sur autorisation PR</td><td>Autorisation préalable obligatoire</td></tr>
<tr><td>FNAEG + FAED</td><td>Art. 706-55 CPP</td><td>OPJ directement</td><td><strong>Réquisitions permanentes — EP incluse</strong></td></tr>
</table></div>
<h2>Types de Réquisitions</h2>
<div class="table-scroll"><table>
<tr><th>Type</th><th>Objet</th></tr>
<tr><td>Générales</td><td>Force publique, moyens de l'État</td></tr>
<tr><td>À personnes qualifiées</td><td>Experts, médecins, UMJ, techniciens</td></tr>
<tr><td>Informatiques</td><td>Opérateurs télécom, FAI — données de connexion et identification</td></tr>
<tr><td>À manœuvrier</td><td>Ouverture de coffres, serrures, véhicules</td></tr>
<tr><td>Prélèvement sanguin</td><td>Alcoolémie, dépistage de stupéfiants</td></tr>
<tr><td>Bancaires (FICOBA)</td><td>Comptes bancaires et mouvements financiers</td></tr>
<tr><td>X-Ray téléphone</td><td>Analyse données téléphone — hors enquête — par personne qualifiée</td></tr>
<tr><td>Interceptions (Art. 100 CPP)</td><td>Uniquement en information judiciaire (JI)</td></tr>
</table></div>
<div class="ok"><strong>✓ Objectif :</strong> La manifestation de la vérité. Toute réquisition = PV de réquisition + réponse écrite du requis.</div>
<div class="piege"><strong>⚠️ FNAEG / FAED :</strong> Réquisitions permanentes = l'OPJ peut accéder sans autorisation du Parquet, même en enquête préliminaire.</div>`
};

function renderPrintList(){
  const el=document.getElementById('print-list');if(!el)return;
  if(typeof PRINT_SHEETS==='undefined'||!PRINT_SHEETS.length){
    el.innerHTML='<div class="empty-state"><span class="empty-state-em">📄</span>Aucune fiche disponible</div>';return;
  }
  el.innerHTML=PRINT_SHEETS.map((s,i)=>{
    return`<div onclick="PRINT28.open('${s.id}')" style="
  display:flex;
  align-items:center;
  gap:12px;
  padding:14px;
  background:var(--bg-1);
  border:1px solid var(--brd);
  border-radius:12px;
  margin-bottom:8px;
  cursor:pointer;
  box-sizing:border-box;
  animation:fadeUp .15s ${i*0.04}s both;
">
  <div style="font-size:28px;flex-shrink:0;">${s.emoji}</div>
  <div style="flex:1;min-width:0;">
    <div style="font-size:13px;font-weight:700;color:var(--t1);
      margin-bottom:2px;">${s.title}</div>
    <div style="font-size:10px;color:var(--t3);
      font-family:'JetBrains Mono',monospace;">${s.sub}</div>
  </div>
  <div style="font-size:16px;color:var(--t3);flex-shrink:0;">›</div>
</div>`;
  }).join('');
}


const PRINT28={
  open(id){
    const sheet=PRINT_SHEETS.find(s=>s.id===id);
    const content=PRINT_CONTENT[id];
    if(!sheet||!content)return;
    const body=document.getElementById('lesson-modal-body');
    const ov=document.getElementById('lesson-ov');
    if(!body||!ov)return;
    body.innerHTML=`
      <div class="sheet-handle" onclick="closeLesson()" style="cursor:pointer"></div>
      <div style="padding:16px 18px 24px">
        <div class="font-title fw-800 text-xl mb4">${sheet.emoji} ${sheet.title}</div>
        <div class="text-xs text-muted font-mono mb16">${sheet.sub}</div>
        <div class="print-sheet-content" style="font-size:12.5px;color:var(--t2);line-height:1.75">${content}</div>
        <div style="margin-top:20px;display:flex;gap:8px">
          <button class="btn btn-p" style="flex:1" onclick="PRINT28.printSheet('${id}')">🖨️ Imprimer</button>
          <button class="btn btn-ghost" onclick="closeLesson()">Fermer</button>
        </div>
      </div>`;
    // Style the content
    const style=document.createElement('style');
    style.textContent=`.print-sheet-content table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}.print-sheet-content th{background:var(--accent);color:#fff;padding:5px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.04em}.print-sheet-content td{padding:5px 8px;border-bottom:1px solid var(--brd);color:var(--t2)}.print-sheet-content h1{font-family:'Syne',sans-serif;font-size:15px;font-weight:900;color:var(--t1);margin-bottom:10px;border-bottom:2px solid var(--accent-l);padding-bottom:5px}.print-sheet-content h2{font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.07em;margin:12px 0 6px}.print-sheet-content p{font-size:12px;color:var(--t2);line-height:1.65;margin-bottom:7px}.print-sheet-content .piege-box{background:var(--err-bg);border:1px solid rgba(239,68,68,.2);border-radius:var(--r-m);padding:10px 12px;margin:8px 0;font-size:11px;color:var(--err)}`;
    body.appendChild(style);
    ov.classList.add('on');
    document.body.style.overflow='hidden';
    /* Enregistrer l'ouverture comme vue */
    if(!S.printed)S.printed={};
    if(!S.printed[id+'_viewed']){S.printed[id+'_viewed']=Date.now();save();renderPrintList();}
  },
  printSheet(id){
    const content=PRINT_CONTENT[id];
    const sheet=PRINT_SHEETS.find(s=>s.id===id);
    if(!content||!sheet)return;
    /* Marquer comme imprimé */
    if(!S.printed[id]){
      S.printed[id]=Date.now();
      S.printDone=(S.printDone||0)+1;
      save();
      renderPrintList();
      checkBadges();
    }
    const w=window.open('','_blank','width=800,height=950');
    if(!w)return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OPJ Elite — ${sheet.title}</title><style>
body{font-family:Georgia,serif;font-size:10pt;color:#000;background:#fff;padding:18mm;margin:0}
h1{font-size:14pt;border-bottom:2pt solid #2563eb;padding-bottom:4pt;margin-bottom:8pt;color:#1a1a2e}
h2{font-size:11pt;color:#2563eb;margin:9pt 0 4pt}
table{width:100%;border-collapse:collapse;margin-bottom:7pt;font-size:9pt}
th{background:#2563eb;color:#fff;padding:4pt 5pt;text-align:left;font-size:8pt;font-family:monospace}
td{padding:3pt 5pt;border-bottom:0.5pt solid #ccc;vertical-align:top}
p,li{font-size:9pt;line-height:1.55;margin-bottom:4pt}
.piege-box{background:#fff5f5;border:1pt solid #cc0000;padding:5pt;border-radius:2pt;margin:5pt 0;font-size:8.5pt;color:#cc0000}
strong{font-weight:bold}
footer{position:fixed;bottom:8mm;left:18mm;right:18mm;text-align:center;font-size:7pt;color:#999;border-top:0.5pt solid #ddd;padding-top:3pt}

/* NAV SVG icons v29 */
.nav-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center}
.nav-icon svg{transition:stroke var(--tr)}
.nav-btn.active .nav-icon svg{stroke:var(--accent-l)!important}
.nav-btn:not(.active) .nav-icon svg{stroke:var(--t3)!important}



/* ═══════════════════════════════════════════════
   OPJ ELITE v30 — PREMIUM DESIGN SYSTEM
   Inspired by: Linear, Raycast, Vercel, Superhuman
   ═══════════════════════════════════════════════ */

/* MESH GRADIENT BG animé */
body::before{
  content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(ellipse 80% 50% at 20% -10%,rgba(37,99,235,.13),transparent),
    radial-gradient(ellipse 60% 40% at 80% 100%,rgba(139,92,246,.08),transparent),
    radial-gradient(ellipse 50% 60% at 50% 50%,rgba(37,99,235,.04),transparent);
  animation:meshMove 12s ease-in-out infinite alternate;
}
@keyframes meshMove{
  0%{background-position:0% 0%,100% 100%,50% 50%}
  100%{background-position:10% 5%,90% 95%,55% 48%}
}

/* HERO — Premium gradient card */
.hero{
  background:linear-gradient(135deg,rgba(37,99,235,.18) 0%,rgba(37,99,235,.06) 40%,rgba(139,92,246,.08) 100%);
  border:1px solid rgba(59,130,246,.25);
  border-radius:24px;padding:22px;margin-bottom:14px;
  position:relative;overflow:hidden;
  box-shadow:0 0 40px rgba(37,99,235,.12),0 4px 24px rgba(0,0,0,.4);
}
.hero::before{
  content:'⚖️';position:absolute;right:-8px;top:-18px;
  font-size:120px;opacity:.06;pointer-events:none;line-height:1;
  filter:blur(1px);
}
.hero::after{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(99,179,246,.4),transparent);
}
.hero-greeting{
  font-size:11px;color:var(--t3);margin-bottom:2px;
  font-weight:600;text-transform:uppercase;letter-spacing:.1em;
  font-family:'JetBrains Mono',monospace;
}
.hero-name{
  font-family:'Syne',sans-serif;
  font-size:26px;font-weight:900;color:var(--t1);
  margin-bottom:18px;letter-spacing:-.03em;line-height:1.1;
}
.hero-name span{
  display:inline-block;
  background:linear-gradient(135deg,var(--accent-l),var(--violet));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;color:transparent;
}

/* KPI GRID — chiffres qui impressionnent */
.hero-kpis{
  display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px;
}
.hero-kpi{
  background:rgba(0,0,0,.28);
  border:1px solid rgba(255,255,255,.07);
  border-radius:12px;padding:10px 6px;text-align:center;
  position:relative;overflow:hidden;
  transition:transform var(--tr),border-color var(--tr);
}
.hero-kpi:hover{transform:translateY(-2px);border-color:rgba(59,130,246,.3)}
.hero-kpi::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(255,255,255,.03),transparent);
  pointer-events:none;
}
.hero-kv{
  font-family:'JetBrains Mono',monospace;font-size:20px;
  font-weight:700;color:var(--t1);line-height:1;
  transition:transform .3s cubic-bezier(.34,1.56,.64,1);
}
.hero-kpi:hover .hero-kv{transform:scale(1.08)}
.hero-kl{
  font-size:8px;color:var(--t3);margin-top:4px;
  text-transform:uppercase;letter-spacing:.07em;
  font-family:'JetBrains Mono',monospace;
}
.hero-kpi.kpi-xp .hero-kv{color:var(--accent-l)}
.hero-kpi.kpi-streak .hero-kv{color:var(--gold)}
.hero-kpi.kpi-score .hero-kv{color:var(--ok)}
.hero-kpi.kpi-due .hero-kv{color:var(--warn)}

/* BOUTONS HERO */
.hero-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hero-btn-p{
  padding:13px;border-radius:14px;border:none;cursor:pointer;
  background:linear-gradient(135deg,var(--accent),var(--accent-l));
  color:#fff;font-weight:700;font-size:13px;
  font-family:'Inter',sans-serif;
  display:flex;align-items:center;justify-content:center;gap:6px;
  transition:all var(--tr);
  box-shadow:0 4px 16px rgba(37,99,235,.35);
  position:relative;overflow:hidden;
}
.hero-btn-p::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.15),transparent);
  pointer-events:none;
}
.hero-btn-p:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.45)}
.hero-btn-p:active{transform:scale(.97)}
.hero-btn-s{
  padding:13px;border-radius:14px;cursor:pointer;
  border:1px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.05);
  color:var(--t1);font-weight:600;font-size:13px;
  font-family:'Inter',sans-serif;
  display:flex;align-items:center;justify-content:center;gap:6px;
  transition:all var(--tr);backdrop-filter:blur(8px);
}
.hero-btn-s:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);transform:translateY(-1px)}
.hero-btn-s:active{transform:scale(.98)}

/* XP BAR — néon */
.xp-bar{height:3px;background:var(--bg-3);border-radius:100px;overflow:hidden;margin-bottom:18px}
.xp-fill{
  height:100%;
  background:linear-gradient(90deg,var(--accent),var(--accent-l),var(--violet));
  border-radius:100px;
  transition:width .8s cubic-bezier(.4,0,.2,1);
  box-shadow:0 0 8px rgba(59,130,246,.6);
}

/* DÉFI CARD — gold premium */
.defi-card{
  background:linear-gradient(135deg,rgba(212,175,55,.1),rgba(212,175,55,.04));
  border:1px solid rgba(212,175,55,.3);
  border-radius:20px;padding:16px;margin-bottom:12px;
  position:relative;overflow:hidden;
  box-shadow:0 0 24px rgba(212,175,55,.08);
  cursor:pointer;transition:all var(--tr);
}
.defi-card:hover{
  border-color:rgba(212,175,55,.5);
  box-shadow:0 0 32px rgba(212,175,55,.15);
  transform:translateY(-2px);
}
.defi-card::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.04),transparent);
  pointer-events:none;
}
.defi-card::after{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(212,175,55,.4),transparent);
}
.defi-badge{
  display:inline-flex;align-items:center;gap:5px;
  background:rgba(212,175,55,.15);border:1px solid rgba(212,175,55,.25);
  color:var(--gold);font-size:9px;font-weight:700;
  font-family:'JetBrains Mono',monospace;padding:3px 9px;border-radius:100px;
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:9px;
}
.defi-title{
  font-family:'Syne',sans-serif;
  font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;
  letter-spacing:-.01em;
}
.defi-sub{font-size:12px;color:var(--t2);margin-bottom:10px;line-height:1.5}
.defi-countdown{
  font-family:'JetBrains Mono',monospace;font-size:10px;
  color:var(--gold);font-weight:600;
  display:flex;align-items:center;gap:5px;
}

/* WEAK WIDGET — alert rouge premium */
.weak-widget{
  background:linear-gradient(135deg,rgba(239,68,68,.08),rgba(239,68,68,.03));
  border:1px solid rgba(239,68,68,.2);
  border-radius:20px;padding:15px;margin-bottom:12px;
  box-shadow:0 0 20px rgba(239,68,68,.06);
}
.weak-widget-title{
  font-size:10px;font-weight:700;color:var(--err);
  text-transform:uppercase;letter-spacing:.1em;
  margin-bottom:12px;display:flex;align-items:center;gap:6px;
}
.weak-row{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.weak-name{font-size:12px;font-weight:600;color:var(--t1);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.weak-pct{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--err);font-weight:700;flex-shrink:0}
.weak-bar{height:3px;background:rgba(239,68,68,.15);border-radius:100px;overflow:hidden;margin-top:3px}
.weak-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,var(--err),rgba(239,68,68,.6))}

/* STAT CARDS — glassmorphism */
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.stat-card{
  background:var(--bg-1);border:1px solid var(--brd);
  border-radius:16px;padding:16px;text-align:center;
  position:relative;overflow:hidden;
  transition:all var(--tr);
}
.stat-card::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.025),transparent);
  pointer-events:none;
}
.stat-card:hover{border-color:var(--brd-l);transform:translateY(-2px)}
.stat-val{
  font-family:'JetBrains Mono',monospace;font-size:28px;
  font-weight:700;color:var(--accent-l);line-height:1;
  transition:transform .3s cubic-bezier(.34,1.56,.64,1);
}
.stat-card:hover .stat-val{transform:scale(1.08)}
.stat-lbl{font-size:10px;color:var(--t2);margin-top:5px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.05em}

/* CHAPTER CARDS — premium */
.chapter-card{
  background:var(--bg-1);border:1px solid var(--brd);
  border-radius:18px;overflow:hidden;margin-bottom:8px;
  cursor:pointer;transition:all var(--tr);
}
.chapter-card:hover{border-color:var(--brd-l);background:var(--bg-2);transform:translateY(-1px);box-shadow:var(--sh-sm)}
.chapter-card.expanded{border-color:var(--brd-acc);box-shadow:0 0 20px var(--accent-glow)}
.chapter-hd{display:flex;align-items:center;gap:12px;padding:15px 16px}
.chapter-ico{
  width:46px;height:46px;border-radius:14px;
  display:flex;align-items:center;justify-content:center;
  font-size:20px;flex-shrink:0;
  box-shadow:0 2px 8px rgba(0,0,0,.3);
}
.chapter-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:var(--t1);line-height:1.25;white-space:normal;overflow:visible;word-break:normal;}
.chapter-sub{font-size:10px;color:var(--t2);margin-top:2px;white-space:normal;overflow:visible;}
.chapter-prog-txt{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--gold);font-weight:700}

/* LESSON ITEMS */
.lesson-item{
  display:flex;align-items:center;gap:12px;padding:11px 14px;
  border-radius:12px;cursor:pointer;
  transition:background var(--tr);margin-bottom:3px;
}
.lesson-item:hover{background:rgba(255,255,255,.05)}
.lesson-item.done{background:rgba(16,185,129,.04)}
.lesson-em{font-size:18px;flex:0 0 28px;text-align:center}
.lesson-name{font-size:13px;font-weight:600;color:var(--t1)}
.lesson-meta{font-size:10px;color:var(--t3);margin-top:2px;font-family:'JetBrains Mono',monospace}
.lesson-status{
  width:20px;height:20px;border-radius:50%;
  border:1.5px solid var(--bg-4);
  display:flex;align-items:center;justify-content:center;
  font-size:10px;flex-shrink:0;transition:all var(--tr);
}
.lesson-status.done{background:var(--ok);border-color:var(--ok);color:#fff;box-shadow:0 0 8px rgba(16,185,129,.4)}

/* QCM — game feel */
.q-txt{
  font-family:'Syne',sans-serif;
  font-size:19px;font-weight:800;color:var(--t1);
  line-height:1.4;margin-bottom:6px;letter-spacing:-.02em;
}
.q-opt{
  background:var(--bg-2);border:1.5px solid var(--brd);
  border-radius:14px;padding:13px 16px;font-size:13px;
  font-weight:500;color:var(--t1);cursor:pointer;
  text-align:left;width:100%;font-family:'Inter',sans-serif;
  transition:all .15s cubic-bezier(.4,0,.2,1);
  display:flex;align-items:center;gap:12px;
  position:relative;overflow:hidden;
}
.q-opt::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.03),transparent);
  pointer-events:none;
}
.q-opt:hover{
  border-color:var(--accent-l);background:var(--accent-glow);
  transform:translateX(4px);
  box-shadow:0 0 16px rgba(37,99,235,.2);
}
.q-opt:active{transform:scale(.99)}
.q-opt.correct{
  background:var(--ok-bg);border-color:var(--ok);color:var(--ok);
  box-shadow:0 0 16px rgba(16,185,129,.2);
  animation:correctPop .4s cubic-bezier(.34,1.56,.64,1);
}
.q-opt.wrong{
  background:var(--err-bg);border-color:var(--err);color:var(--err);
  animation:shake .35s ease;
}
.q-opt.disabled{pointer-events:none}
.q-letter{
  width:26px;height:26px;background:var(--accent-glow);border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;color:var(--accent-l);flex-shrink:0;
  font-family:'JetBrains Mono',monospace;transition:all .15s;
}
.q-opt:hover .q-letter{background:var(--accent);color:#fff}
.q-opt.correct .q-letter{background:var(--ok);color:#fff}
.q-opt.wrong .q-letter{background:var(--err);color:#fff}
@keyframes correctPop{
  0%{transform:scale(1)}40%{transform:scale(1.03)}100%{transform:scale(1)}
}

/* RÉSULTATS QCM */
.send-wrap{text-align:center;padding:28px 0}
.send-score{
  font-family:'JetBrains Mono',monospace;font-size:64px;font-weight:700;margin:14px 0;
  background:linear-gradient(135deg,var(--accent-l),var(--violet));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  animation:popIn .5s cubic-bezier(.34,1.56,.64,1);
}
.send-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:900;color:var(--t1);margin-bottom:5px}
.send-lbl{font-size:13px;color:var(--t2);margin-bottom:18px}

/* THEME ROWS — révision */
.theme-row{
  display:flex;align-items:center;gap:12px;padding:13px 14px;
  background:var(--bg-1);border:1px solid var(--brd);border-radius:14px;
  margin-bottom:7px;cursor:pointer;transition:all var(--tr);
  position:relative;overflow:hidden;
}
.theme-row::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  background:var(--theme-color, var(--accent));border-radius:0 2px 2px 0;
  opacity:.7;
}
.theme-row:hover{background:var(--bg-2);border-color:var(--brd-l);transform:translateX(3px)}
.theme-name{font-size:13px;font-weight:600;color:var(--t1)}
.theme-meta{font-size:10px;color:var(--t3);margin-top:1px;font-family:'JetBrains Mono',monospace}
.theme-pbar{height:3px;background:var(--bg-3);border-radius:100px;margin-top:5px;overflow:hidden}
.theme-pfill{height:100%;border-radius:100px;transition:width .6s ease}
.theme-pct{font-size:11px;font-weight:700;color:var(--t3);flex-shrink:0;font-family:'JetBrains Mono',monospace}

/* FICHES LAME — bubbles */
.bubble{
  display:flex;flex-direction:column;align-items:center;gap:6px;
  cursor:pointer;transition:transform .18s cubic-bezier(.34,1.56,.64,1);
}
.bubble:active{transform:scale(.88)}
.bubble:hover{transform:translateY(-3px) scale(1.04)}
.bubble-ring{
  width:68px;height:68px;border-radius:50%;
  background:var(--bg-2);border:2px solid var(--bg-4);
  display:flex;align-items:center;justify-content:center;
  position:relative;transition:all .25s;
}
.bubble:hover .bubble-ring{
  border-color:var(--accent-l);
  box-shadow:0 0 16px var(--accent-glow);
}
.bubble.mastered .bubble-ring{
  border-color:var(--gold);background:rgba(212,175,55,.08);
  box-shadow:0 0 14px var(--gold-glow);
}
.bubble.learning .bubble-ring{
  border-color:var(--accent-l);
  box-shadow:0 0 12px var(--accent-glow);
}
.bubble-em{font-size:24px;z-index:1;position:relative}
.bubble-name{
  font-size:8px;font-weight:700;text-align:center;color:var(--t2);
  text-transform:uppercase;letter-spacing:.05em;max-width:78px;
  line-height:1.2;font-family:'JetBrains Mono',monospace;
}
.bubble.mastered .bubble-name{color:var(--gold)}

/* CARDS génériques */
.card{
  background:var(--bg-1);border:1px solid var(--brd);
  border-radius:16px;padding:16px;margin-bottom:12px;
  position:relative;overflow:hidden;
}
.card::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(255,255,255,.02),transparent);
  pointer-events:none;
}

/* BADGES — styles principaux dans css/pages.css (.badge-item, .badge-item-em, .badge-item-name) */
#badge-unlock-ov.badge-unlock--spectacular #bul-emoji{animation:bulSpectacular .85s cubic-bezier(.34,1.56,.64,1) both}
@keyframes bulSpectacular{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.2) rotate(8deg)}100%{transform:scale(1) rotate(0);opacity:1}}

/* TOAST premium */
.toast{
  background:rgba(13,17,23,.95);
  border:1px solid rgba(255,255,255,.1);
  border-radius:14px;padding:11px 18px;
  font-size:13px;font-weight:600;color:var(--t1);
  box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.03);
  white-space:nowrap;
  animation:toastIn .3s cubic-bezier(.34,1.56,.64,1),toastOut .3s ease 2.7s both;
  backdrop-filter:blur(20px);
  display:flex;align-items:center;gap:8px;
}
.toast::before{font-size:15px}
.toast.ok{border-color:rgba(16,185,129,.35);color:var(--ok)}
.toast.ok::before{content:'✓'}
.toast.err{border-color:rgba(239,68,68,.35);color:var(--err)}
.toast.err::before{content:'✕'}
@keyframes toastIn{from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes toastOut{to{opacity:0;transform:translateY(8px)}}

/* SECTION LABELS */
.sect-label{
  font-size:10px;font-weight:700;color:var(--t3);
  text-transform:uppercase;letter-spacing:.12em;
  margin-bottom:12px;margin-top:4px;
  display:flex;align-items:center;gap:8px;
}
.sect-label::before{
  content:'';flex:0 0 3px;height:14px;
  background:linear-gradient(180deg,var(--accent-l),var(--accent));
  border-radius:4px;box-shadow:0 0 6px rgba(59,130,246,.4);
}
.sect-label::after{content:'';flex:1;height:1px;background:var(--brd)}

/* INPUTS premium */
.inp{
  width:100%;max-width:100%;
  box-sizing:border-box;
  background:var(--bg-2);border:1px solid var(--bg-4);
  border-radius:12px;padding:12px 14px;font-size:16px;
  color:var(--t1);font-family:'Inter',sans-serif;outline:none;
  transition:border-color var(--tr),box-shadow var(--tr);
}
.inp:focus{
  border-color:var(--accent-l);
  box-shadow:0 0 0 3px var(--accent-glow),0 0 12px rgba(37,99,235,.1);
}

/* BLITZ — hyper engageant */
.blitz-q{
  font-family:'Syne',sans-serif;
  font-size:20px;font-weight:800;color:var(--t1);
  line-height:1.4;margin-bottom:30px;max-width:440px;
  text-align:center;letter-spacing:-.02em;
}
.blitz-btn{
  padding:18px;border-radius:18px;border:2px solid transparent;
  font-size:15px;font-weight:700;font-family:'Inter',sans-serif;
  cursor:pointer;transition:all .15s cubic-bezier(.34,1.56,.64,1);
}
.blitz-btn-ko{background:var(--err-bg);border-color:rgba(239,68,68,.25);color:var(--err)}
.blitz-btn-ok{background:var(--ok-bg);border-color:rgba(16,185,129,.25);color:var(--ok)}
.blitz-btn-ko:active,.blitz-btn-ko.sel{background:var(--err);border-color:var(--err);color:#fff;transform:scale(.96)}
.blitz-btn-ok:active,.blitz-btn-ok.sel{background:var(--ok);border-color:var(--ok);color:#fff;transform:scale(.96)}
.blitz-btn:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,.3)}

/* PROC FICHE bottom sheet */
.pf-ov{
  position:fixed;inset:0;display:none;align-items:flex-end;
  z-index:200;background:rgba(0,0,0,.7);backdrop-filter:blur(10px);
}
.pf-sheet{
  background:var(--bg-1);border-radius:24px 24px 0 0;
  border-top:1px solid var(--brd-l);
  width:100%;max-width:600px;margin:0 auto;
  max-height:88dvh;overflow-y:auto;
  animation:sheetUp .3s cubic-bezier(.25,.46,.45,.94);
  box-shadow:0 -8px 48px rgba(0,0,0,.6);
}

/* CARTOUCHES */
.cart-field{display:flex;align-items:baseline;gap:8px;padding:9px 0;border-bottom:1px solid var(--brd)}
.cart-lbl{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;flex-shrink:0;min-width:115px;font-family:'JetBrains Mono',monospace}
.cart-val{font-size:13px;color:var(--t1);flex:1}
.cart-val.critical{color:var(--accent-l);font-weight:700}
.cart-piege{background:var(--err-bg);border:1px solid rgba(239,68,68,.2);border-radius:12px;padding:11px 13px;margin-top:8px}
.cart-piege-lbl{font-size:9px;font-weight:700;color:var(--err);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}

/* PRINT CARDS */
.print-card{
  background:var(--bg-1);border:1px solid var(--brd);border-radius:16px;
  padding:14px;display:flex;align-items:center;gap:12px;
  cursor:pointer;transition:all var(--tr);margin-bottom:8px;
  position:relative;overflow:hidden;
}
.print-card::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.02),transparent);pointer-events:none;
}
.print-card:hover{background:var(--bg-2);border-color:var(--brd-l);transform:translateX(4px)}
.print-card-em{font-size:28px;flex-shrink:0}
.print-card-title{font-size:13px;font-weight:700;color:var(--t1)}
.print-card-sub{font-size:10px;color:var(--t3);margin-top:2px;font-family:'JetBrains Mono',monospace}

/* PROFIL */
.profil-av{font-size:56px;text-align:center;margin-bottom:4px;padding-top:8px;
  animation:float 3s ease-in-out infinite alternate;
}
@keyframes float{from{transform:translateY(0)}to{transform:translateY(-5px)}}
.profil-name{
  font-family:'Syne',sans-serif;font-size:24px;font-weight:900;
  color:var(--t1);text-align:center;letter-spacing:-.03em;margin-bottom:2px;
}
.profil-grade{
  font-size:11px;color:var(--t3);text-align:center;margin-bottom:16px;
  text-transform:uppercase;letter-spacing:.08em;font-family:'JetBrains Mono',monospace;
}
.profil-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.profil-stat{
  background:var(--bg-1);border:1px solid var(--brd);
  border-radius:14px;padding:13px;text-align:center;
  transition:all var(--tr);
}
.profil-stat:hover{border-color:var(--brd-l);transform:translateY(-2px)}
.ps-val{font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--accent-l)}
.ps-lbl{font-size:9px;color:var(--t3);margin-top:3px;text-transform:uppercase;letter-spacing:.07em}

/* SCROLL CUSTOM */
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bg-4);border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:var(--t3)}

/* STREAK DANGER */
.streak-danger-ov{
  position:fixed;inset:0;background:rgba(239,68,68,.12);z-index:300;
  display:none;align-items:center;justify-content:center;
  backdrop-filter:blur(8px);
}

/* REV TABS */
.rev-tab{
  flex-shrink:0;padding:7px 14px;border-radius:100px;
  font-size:11px;font-weight:600;cursor:pointer;
  background:var(--bg-2);color:var(--t2);border:1px solid var(--brd);
  font-family:'Inter',sans-serif;transition:all var(--tr);
}
.rev-tab.active{
  background:var(--accent);color:#fff;border-color:var(--accent-l);
  box-shadow:0 0 14px rgba(37,99,235,.35);
}
.rev-tab:hover:not(.active){background:var(--bg-3)}

/* EXAMEN PAGE */
.exam-hero{
  background:linear-gradient(135deg,rgba(239,68,68,.1),rgba(239,68,68,.03));
  border:1px solid rgba(239,68,68,.2);border-radius:20px;
  padding:18px;margin-bottom:14px;
  box-shadow:0 0 24px rgba(239,68,68,.06);
}
.exam-hero h3{
  font-family:'Syne',sans-serif;font-size:17px;
  font-weight:900;color:var(--err);margin-bottom:5px;
}
.exam-hero p{font-size:12px;color:var(--t2);line-height:1.6}
.mode-card{
  background:var(--bg-1);border:1px solid var(--brd);border-radius:18px;
  padding:16px;margin-bottom:9px;cursor:pointer;transition:all var(--tr);
  display:flex;gap:14px;align-items:flex-start;position:relative;overflow:hidden;
}
.mode-card::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.02),transparent);pointer-events:none;
}
.mode-card:hover{
  background:var(--bg-2);border-color:var(--brd-l);
  transform:translateY(-2px);box-shadow:var(--sh);
}
.mode-ico{
  width:46px;height:46px;border-radius:14px;
  display:flex;align-items:center;justify-content:center;font-size:20px;
  flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.25);
}
.mode-inf h4{font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px}
.mode-inf p{font-size:11px;color:var(--t2);line-height:1.55}

/* ONBOARDING */
.onb-logo{font-size:52px;text-align:center;margin-bottom:10px;animation:float 3s ease-in-out infinite alternate}

/* BOTTOM NAV — ultra pro */
.bnav{
  position:fixed;bottom:0;left:0;right:0;
  height:calc(var(--nav-h) + var(--safe-b));
  padding-bottom:var(--safe-b);
  background:rgba(6,9,16,.95);
  backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  border-top:1px solid rgba(255,255,255,.05);
  display:flex;align-items:flex-start;padding-top:2px;
  z-index:100;
}
.nav-btn{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:9px 4px 7px;background:none;border:none;cursor:pointer;min-height:var(--tap-h);
  color:var(--t3);font-family:'JetBrains Mono',monospace;
  font-size:9px;font-weight:500;letter-spacing:.05em;text-transform:uppercase;
  transition:color var(--tr),transform var(--tr);
  position:relative;
}
.nav-btn::before{
  content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:0;height:2px;background:var(--accent-l);border-radius:0 0 2px 2px;
  transition:width var(--tr);
}
.nav-btn.active{color:var(--accent-l);transform:translateY(-1px)}
.nav-btn.active::before{width:22px}
.nav-icon{
  width:22px;height:22px;
  display:flex;align-items:center;justify-content:center;
  transition:transform var(--tr);
}
.nav-btn.active .nav-icon{transform:translateY(-1px)}
.nav-btn.active .nav-icon svg{stroke:var(--accent-l)!important}
.nav-btn:not(.active) .nav-icon svg{stroke:var(--t3)!important}

/* APP HEADER */
.app-hdr{
  position:fixed;top:0;left:0;right:0;
  height:calc(var(--hdr-h) + var(--safe-t));padding-top:var(--safe-t);
  background:rgba(6,9,16,.92);backdrop-filter:blur(20px);
  border-bottom:1px solid rgba(255,255,255,.05);
  display:flex;align-items:center;
  padding-left:16px;padding-right:16px;gap:10px;z-index:100;
}
.hdr-logo{
  font-family:'Syne',sans-serif;
  font-size:16px;font-weight:900;color:var(--t1);
  letter-spacing:-.03em;flex:1;
}
.hdr-logo span{color:var(--accent-l)}
.hdr-badge{
  font-family:'JetBrains Mono',monospace;font-size:9px;
  background:linear-gradient(135deg,var(--accent),var(--violet));
  color:#fff;padding:2px 7px;border-radius:6px;
  font-weight:600;letter-spacing:.04em;
}
.hdr-xp{
  font-family:'JetBrains Mono',monospace;font-size:12px;
  color:var(--gold);font-weight:600;flex-shrink:0;
}

/* SEARCH */
.search-wrap{position:relative;margin-bottom:14px}
.search-inp{
  width:100%;background:var(--bg-2);border:1px solid var(--bg-4);
  border-radius:14px;padding:10px 40px;font-size:13px;color:var(--t1);
  font-family:'Inter',sans-serif;outline:none;
  transition:border-color var(--tr),box-shadow var(--tr);
}
.search-inp:focus{
  border-color:var(--accent-l);
  box-shadow:0 0 0 3px var(--accent-glow),0 0 12px rgba(37,99,235,.08);
}
.search-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:15px;pointer-events:none}
.search-clear{position:absolute;right:11px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--t3);font-size:15px;cursor:pointer;display:none}

/* PAGE TRANSITIONS */
.page{max-width:560px;margin:0 auto;padding:14px var(--page-px) 40px;animation:pgIn .22s ease both}
@keyframes pgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* PROGRESS RING */
.ring-wrap{position:relative;flex-shrink:0}
.ring-wrap svg{transform:rotate(-90deg)}
.ring-bg{fill:none;stroke:var(--bg-3);stroke-width:3}
.ring-prog{fill:none;stroke-width:3;stroke-linecap:round;transition:stroke-dashoffset .7s ease}

/* FAB */
.fab{
  position:fixed;right:16px;bottom:calc(var(--nav-h) + var(--safe-b) + 12px);
  width:52px;height:52px;border-radius:50%;
  background:linear-gradient(135deg,var(--accent),var(--accent-l));
  border:none;cursor:pointer;z-index:90;
  display:flex;align-items:center;justify-content:center;font-size:20px;
  box-shadow:0 4px 20px rgba(37,99,235,.45),0 0 0 1px rgba(255,255,255,.1);
  transition:all .2s cubic-bezier(.34,1.56,.64,1);
}
.fab:hover{transform:scale(1.1) translateY(-2px);box-shadow:0 8px 28px rgba(37,99,235,.55)}
.fab:active{transform:scale(.92)}

/* FOCUS a11y */
:focus-visible{outline:2px solid var(--accent-l);outline-offset:2px}

/* PREFERS REDUCED MOTION */
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}



/* ═══════════════════════════════════════════
   EXTRAS DESIGN v30 — polissage final
   ═══════════════════════════════════════════ */

/* FSRS WIDGET */
.fsrs-widget{
  display:flex;align-items:center;gap:12px;
  background:linear-gradient(135deg,rgba(37,99,235,.1),rgba(37,99,235,.03));
  border:1px solid rgba(59,130,246,.2);border-radius:16px;
  padding:14px 16px;margin-bottom:12px;cursor:pointer;
  transition:all var(--tr);
}
.fsrs-widget:hover{
  border-color:rgba(59,130,246,.35);
  box-shadow:0 0 20px rgba(37,99,235,.12);
  transform:translateY(-1px);
}
.fsrs-count{
  font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;
  color:var(--accent-l);line-height:1;min-width:44px;
}
.fsrs-count.urgent{color:var(--err)}
.fsrs-count.fresh{color:var(--ok)}
.fsrs-inf-title{font-size:13px;font-weight:700;color:var(--t1);margin-bottom:2px}
.fsrs-inf-sub{font-size:11px;color:var(--t2)}
.fsrs-arrow{margin-left:auto;color:var(--t3);font-size:16px}

/* EXAM COUNTDOWN */
.exam-countdown{
  display:flex;flex-direction:column;align-items:center;
  background:linear-gradient(135deg,rgba(212,175,55,.1),rgba(212,175,55,.03));
  border:1px solid rgba(212,175,55,.2);border-radius:18px;
  padding:18px;margin-bottom:12px;text-align:center;
  box-shadow:0 0 20px rgba(212,175,55,.06);
}
.exam-countdown-days{
  font-family:'JetBrains Mono',monospace;font-size:42px;font-weight:700;
  color:var(--gold);line-height:1;
  text-shadow:0 0 20px rgba(212,175,55,.3);
}
.exam-countdown-lbl{font-size:10px;color:var(--t3);margin-top:6px;text-transform:uppercase;letter-spacing:.1em}

/* CHAPTER PROGRESS BARS */
.ch-prog-row{
  display:flex;align-items:center;gap:10px;
  padding:9px 0;border-bottom:1px solid var(--brd);
}
.ch-prog-row:last-child{border-bottom:none}
.ch-prog-icon{font-size:16px;width:22px;text-align:center;flex-shrink:0}
.ch-prog-inf{flex:1;min-width:0}
.ch-prog-name{font-size:12px;font-weight:600;color:var(--t1);margin-bottom:4px}
.ch-prog-bar{height:4px;background:var(--bg-3);border-radius:100px;overflow:hidden}
.ch-prog-fill{height:100%;border-radius:100px;transition:width .6s ease;box-shadow:0 0 6px rgba(59,130,246,.3)}
.ch-prog-pct{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--t3);flex-shrink:0;width:30px;text-align:right}

/* BANNERS & ALERTS */
.info-banner{
  display:flex;align-items:flex-start;gap:10px;
  padding:12px 14px;background:var(--bg-1);
  border:1px solid var(--brd);border-radius:14px;margin-bottom:12px;
}
.info-banner.accent{
  background:rgba(37,99,235,.05);border-color:rgba(59,130,246,.2);
}
.info-banner.gold{
  background:rgba(212,175,55,.05);border-color:rgba(212,175,55,.2);
}

/* TAGS */
.tag{
  font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;
  padding:2px 7px;border-radius:5px;letter-spacing:.04em;
  display:inline-flex;align-items:center;gap:3px;
}
.tag-accent{background:var(--accent-glow);color:var(--accent-l);border:1px solid var(--brd-acc)}
.tag-gold{background:var(--gold-glow);color:var(--gold);border:1px solid rgba(212,175,55,.2)}
.tag-ok{background:var(--ok-bg);color:var(--ok)}
.tag-err{background:var(--err-bg);color:var(--err)}
.tag-warn{background:var(--warn-bg);color:var(--warn)}

/* ACTIVITY BARS */
.activity-bars{display:flex;align-items:flex-end;gap:2px;height:52px}
.activity-bar{
  flex:1;background:var(--bg-3);border-radius:3px 3px 0 0;
  transition:height .4s ease;cursor:default;min-height:4px;
}
.activity-bar.active{
  background:linear-gradient(180deg,var(--accent-l),var(--accent));
  box-shadow:0 0 6px rgba(59,130,246,.3);
}
.activity-bar.streak{
  background:linear-gradient(180deg,var(--gold-l),var(--gold));
  box-shadow:0 0 6px rgba(212,175,55,.3);
}

/* LESSON MODAL */
.lesson-ov{
  position:fixed;inset:0;display:none;
  align-items:flex-end;z-index:200;
  background:rgba(0,0,0,.72);backdrop-filter:blur(12px);
}
.lesson-ov.on{display:flex;animation:pgIn .2s ease}
.lesson-sheet{
  width:100%;max-width:600px;margin:0 auto;
  max-height:93dvh;overflow-y:auto;
  background:var(--bg-1);border-radius:24px 24px 0 0;
  border-top:1px solid rgba(255,255,255,.08);
  animation:sheetUp .3s cubic-bezier(.25,.46,.45,.94);
  box-shadow:0 -12px 60px rgba(0,0,0,.7);
}
.sheet-handle{
  width:40px;height:5px;background:rgba(255,255,255,.15);
  border-radius:3px;margin:14px auto 0;cursor:pointer;
  transition:background var(--tr);
}
.sheet-handle:hover{background:rgba(255,255,255,.3)}

/* BLITZ OVERLAY */
.blitz-ov{
  position:fixed;inset:0;background:var(--bg-0);
  z-index:250;display:none;flex-direction:column;
}
.blitz-ov.show{display:flex;animation:pgIn .2s ease}
.blitz-timer-bar{height:5px;background:var(--bg-3);flex:1;border-radius:100px;overflow:hidden}
.blitz-timer-fill{
  height:100%;
  background:linear-gradient(90deg,var(--ok),var(--warn),var(--err));
  border-radius:100px;transition:width .5s linear;
}
.blitz-body{
  flex:1;display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  padding:24px;text-align:center;
}

/* DEFI card done state */
.defi-card.defi-done{
  background:linear-gradient(135deg,rgba(16,185,129,.08),rgba(16,185,129,.03));
  border-color:rgba(16,185,129,.25);
}
.defi-done .defi-badge{background:var(--ok-bg);border-color:rgba(16,185,129,.2);color:var(--ok)}
.defi-done .defi-title{color:var(--ok)}

/* BOUTONS */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  padding:12px 18px;border-radius:12px;border:none;
  font-family:'Inter',sans-serif;font-size:14px;font-weight:600;
  cursor:pointer;transition:all var(--tr);white-space:nowrap;
}
.btn-p{
  background:linear-gradient(135deg,var(--accent),var(--accent-l));
  color:#fff;width:100%;padding:14px;font-size:15px;border-radius:14px;
  box-shadow:0 4px 16px rgba(37,99,235,.3);
}
.btn-p:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.4)}
.btn-p:active{transform:scale(.97)}
.btn-gold{
  background:linear-gradient(135deg,var(--gold),var(--gold-l));
  color:#1a1200;width:100%;padding:14px;font-size:15px;border-radius:14px;font-weight:700;
  box-shadow:0 4px 16px rgba(212,175,55,.25);
}
.btn-gold:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(212,175,55,.35)}
.btn-ghost{background:transparent;color:var(--t2);border:1px solid var(--brd-l)}
.btn-ghost:hover{background:var(--bg-3)}
.btn-full{width:100%}
.btn-sm{padding:8px 13px;font-size:12px;border-radius:8px}
.btn-danger{background:var(--err-bg);color:var(--err);border:1px solid rgba(239,68,68,.25)}

/* PRO CARD */
.pro-price-card{
  background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(212,175,55,.04));
  border:1px solid rgba(212,175,55,.3);border-radius:20px;
  padding:22px;text-align:center;margin-bottom:16px;
  box-shadow:0 0 32px rgba(212,175,55,.1);
}
.pro-price{
  font-family:'JetBrains Mono',monospace;font-size:44px;font-weight:700;color:var(--gold);
  text-shadow:0 0 20px rgba(212,175,55,.3);
}


/* iOS — Prevent input zoom */
input,select,textarea,.inp{font-size:16px!important;box-sizing:border-box!important;max-width:100%!important}
@media (min-width:400px){input,select,textarea,.inp{font-size:16px!important;box-sizing:border-box!important;max-width:100%!important}}


/* ══ PROC GROUPS v33 ══ */
.proc-group{margin-bottom:18px}
.proc-group-hd{
  display:flex;align-items:center;gap:9px;padding:10px 14px;
  border-radius:var(--r-m);margin-bottom:8px;cursor:pointer;
  border:1px solid rgba(255,255,255,.06);
  user-select:none;
}
.proc-group-hd-left{display:flex;align-items:center;gap:9px;flex:1;min-width:0}
.proc-group-ico{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px}
.proc-group-title{font-size:13px;font-weight:800;color:var(--t1);letter-spacing:.01em;font-family:'Syne',sans-serif}
.proc-group-sub{font-size:10px;color:var(--t3);font-family:'JetBrains Mono',monospace;margin-top:1px}
.proc-group-badge{font-size:9px;font-weight:700;padding:3px 7px;border-radius:20px;margin-left:auto;flex-shrink:0;font-family:'JetBrains Mono',monospace}
.proc-group-arrow{font-size:14px;color:var(--t3);margin-left:6px;transition:transform .2s;flex-shrink:0}
.proc-group-hd.collapsed .proc-group-arrow{transform:rotate(-90deg)}
.proc-group-items{display:flex;flex-direction:column;gap:5px}
.proc-group-items.hidden{display:none}

.proc-card{
  display:flex;align-items:center;gap:11px;padding:11px 13px;
  background:var(--bg-1);border:1px solid var(--brd);
  border-radius:var(--r-m);cursor:pointer;
  transition:border-color .18s,background .18s;
  position:relative;overflow:hidden;
}
.proc-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px;background:var(--proc-color,var(--brd))}
.proc-card:active{background:var(--bg-2)}
.proc-card.done{border-color:rgba(212,175,55,.25);background:rgba(212,175,55,.04)}
.proc-card.done::after{content:'✓';position:absolute;right:11px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--gold)}
.proc-card-num{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;font-family:'JetBrains Mono',monospace;flex-shrink:0}
.proc-card-body{flex:1;min-width:0}
.proc-card-nm{font-size:13px;font-weight:700;color:var(--t1);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.proc-card-ref{font-size:10px;color:var(--t3);font-family:'JetBrains Mono',monospace;margin-top:2px}
.proc-card-dur{font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:auto;flex-shrink:0;white-space:nowrap}
.proc-card.done .proc-card-dur{opacity:0}

.proc-summary-bar{
  display:flex;align-items:center;gap:10px;padding:12px 14px;
  background:var(--bg-1);border:1px solid var(--brd);
  border-radius:var(--r-m);margin-bottom:14px;
}
.proc-summary-bar-track{flex:1;height:6px;background:var(--bg-4);border-radius:3px;overflow:hidden}
.proc-summary-bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent-l));transition:width .4s}
.proc-summary-txt{font-size:10px;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--t2);white-space:nowrap}

/* ══ LP CARDS v33 ══ */
.lp-header{padding:16px 0 12px;margin-bottom:4px}
.lp-header-title{font-size:18px;font-weight:900;color:var(--t1);font-family:'Syne',sans-serif}
.lp-header-sub{font-size:11px;color:var(--t3);margin-top:3px;font-family:'JetBrains Mono',monospace}
.lp-progress-row{display:flex;align-items:center;gap:10px;margin-top:10px}
.lp-progress-track{flex:1;height:6px;background:var(--bg-4);border-radius:3px;overflow:hidden}
.lp-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#d4af37,#f0c040);transition:width .4s}
.lp-progress-txt{font-size:10px;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--gold)}

.lp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding-bottom:20px}
@media(max-width:360px){.lp-grid{grid-template-columns:1fr}}

.lp-card{
  border-radius:16px;background:var(--bg-1);
  border:1.5px solid var(--brd);cursor:pointer;
  overflow:hidden;transition:border-color .18s,transform .1s;
  display:flex;flex-direction:column;
}
.lp-card:active{transform:scale(.97)}
.lp-card.done{border-color:rgba(212,175,55,.35)}
.lp-card-hero{padding:14px 14px 10px;display:flex;flex-direction:column;gap:6px;position:relative;flex:1}
.lp-card-em{font-size:28px;line-height:1;filter:drop-shadow(0 3px 8px rgba(0,0,0,.3))}
.lp-card-source{font-size:8px;font-weight:800;padding:2px 6px;border-radius:20px;width:fit-content;letter-spacing:.06em;font-family:'JetBrains Mono',monospace;text-transform:uppercase}
.lp-card-nm{font-size:13px;font-weight:800;color:var(--t1);line-height:1.3;font-family:'Syne',sans-serif}
.lp-card-ref{font-size:9px;color:var(--t3);font-family:'JetBrains Mono',monospace;line-height:1.4}
.lp-card-def{font-size:10.5px;color:var(--t2);line-height:1.5;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lp-card-footer{padding:8px 14px;border-top:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between}
.lp-card-done-badge{font-size:9px;font-weight:700;color:var(--gold);font-family:'JetBrains Mono',monospace}
.lp-card-arr{font-size:14px;color:var(--t3)}
.lp-card.done .lp-card-footer{background:rgba(212,175,55,.05)}
</style></head><body>
${content}
<footer>OPJ Elite v57.0 — Fiche pédagogique — À usage privé uniquement</footer>
</body></html>`);
    w.document.close();w.focus();
    setTimeout(()=>{w.print();},500);
  }
};

/* ─── RENDER ANNALES ─── */


/* ─── RENDER PROC LIST (from PB) ─── */
function renderProcList(){
  const el=document.getElementById('proc-list-rev');if(!el)return;
  if(typeof PB==='undefined'||!PB.length){el.innerHTML='<div class="empty-state"><span class="empty-state-em">📋</span>Aucune procédure disponible</div>';return;}
  const pfs=S.pfs||{};
  const doneCount=PB.filter(p=>pfs[p.id]==='m').length;
  const pct=Math.round(doneCount/PB.length*100);

  const GROUPS=[
    {id:'gav',  label:'Garde à Vue',              em:'🔒',color:'#3b82f6',ids:['P01','P02','P03'],sub:'Art. 62-2 · 63 · 706-88 CPP',diff:1},
    {id:'enq',  label:'Cadres d\'enquête',          em:'🔍',color:'#f59e0b',ids:['P04','P05','P06'],sub:'Art. 53 · 75 · 151 CPP',diff:2},
    {id:'perid',label:'Perquisitions & Identité',   em:'🏠',color:'#8b5cf6',ids:['P07','P08'],sub:'Art. 56 · 76 · 78-1 CPP',diff:2},
    {id:'mand', label:'Mandats & Sûreté',           em:'⛓️',color:'#ec4899',ids:['P09','P12','P13','P14','P15'],sub:'Art. 122 · 137 · 143-1 CPP',diff:3},
    {id:'min',  label:'Mineurs & CJPM',             em:'👶',color:'#22d3ee',ids:['P10','P16'],sub:'CJPM — Loi 26/09/2021',diff:2},
    {id:'ap',   label:'Action publique & Suites',   em:'⚖️',color:'#10b981',ids:['P18','P21','P23','P24','P25'],sub:'Art. 6 · 40-1 · 41-1 CPP',diff:3},
    {id:'prv',  label:'Preuve, Nullités & TSE',     em:'🔬',color:'#ef4444',ids:['P11','P19','P20','P28'],sub:'Art. 100 · 171 · 427 CPP',diff:3},
    {id:'inst', label:'Instruction judiciaire',     em:'🏛️',color:'#0ea5e9',ids:['P26','P27'],sub:'Art. 80 · 175 · 185 CPP',diff:3},
    {id:'jug',  label:'Jugement & Recours',         em:'🎓',color:'#6366f1',ids:['P17','P29','P30','P31','P32','P36'],sub:'Art. 381 · 231 · 496 CPP',diff:4},
    {id:'ctrl', label:'Contrôle & Fichiers',        em:'🗃️',color:'#a855f7',ids:['P22','P35','P37','P38'],sub:'Art. 224 · 230-6 CPP · RGPD',diff:2},
    {id:'intl', label:'Coopération internationale', em:'🌍',color:'#14b8a6',ids:['P33','P34'],sub:'Art. 695-11 CPP · Conventions',diff:4},
  ];

  const diffLabel=['','Fondamental','Intermédiaire','Avancé','Expert'];
  const diffColor=['','#10b981','#f59e0b','#ef4444','#8b5cf6'];

  let html=`
  <div class="proc-hero">
    <div class="proc-hero-left">
      <div class="proc-hero-title">📋 Procédure Pénale</div>
      <div class="proc-hero-sub">${PB.length} fiches · CPP & CJPM</div>
    </div>
    <div class="proc-hero-ring">
      <svg width="64" height="64" viewBox="0 0 64 64" style="transform:rotate(-90deg)">
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--bg-3)" stroke-width="5"/>
        <circle cx="32" cy="32" r="26" fill="none" stroke="url(#procGrad)" stroke-width="5"
          stroke-linecap="round" stroke-dasharray="163.4"
          stroke-dashoffset="${(163.4*(1-pct/100)).toFixed(1)}"/>
        <defs><linearGradient id="procGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#d4af37"/>
        </linearGradient></defs>
      </svg>
      <div class="proc-hero-pct">${pct}%</div>
    </div>
  </div>
  <div class="proc-stats-row">
    <div class="proc-stat"><div class="proc-stat-v">${doneCount}</div><div class="proc-stat-l">Maîtrisées</div></div>
    <div class="proc-stat"><div class="proc-stat-v">${PB.length-doneCount}</div><div class="proc-stat-l">Restantes</div></div>
    <div class="proc-stat"><div class="proc-stat-v">${GROUPS.length}</div><div class="proc-stat-l">Chapitres</div></div>
  </div>`;

  GROUPS.forEach((g,gi)=>{
    const items=PB.filter(p=>g.ids.includes(p.id));
    if(!items.length)return;
    const gDone=items.filter(p=>pfs[p.id]==='m').length;
    const gPct=Math.round(gDone/items.length*100);
    const completed=gDone===items.length;
    const dc=diffColor[g.diff]||'#6366f1';
    html+=`
    <div class="proc-group2" style="animation:fadeUp .2s ${gi*0.04}s both">
      <div class="proc-group2-hd" style="--gc:${g.color}" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('show')">
        <div class="proc-group2-ico" style="background:${g.color}20;border:2px solid ${g.color}40">${g.em}</div>
        <div class="proc-group2-inf">
          <div class="proc-group2-title">${g.label}</div>
          <div class="proc-group2-meta">
            <span class="proc-diff-tag" style="background:${dc}18;color:${dc}">${diffLabel[g.diff]}</span>
            <span class="proc-group2-sub">${g.sub}</span>
          </div>
          <div class="proc-group2-bar">
            <div class="proc-group2-bar-fill" style="width:${gPct}%;background:${g.color}"></div>
          </div>
        </div>
        <div class="proc-group2-right">
          ${completed
            ? `<div class="proc-group2-done">✓</div>`
            : `<div class="proc-group2-count" style="color:${g.color}">${gDone}<span>/${items.length}</span></div>`
          }
          <div class="proc-group2-arrow">›</div>
        </div>
      </div>
      <div class="proc-group2-items">
        ${items.map((p,pi)=>{
          const done=pfs[p.id]==='m';
          return`<div class="proc-card2${done?' done':''}" onclick="PFM.open('${p.id}')" style="animation:fadeUp .15s ${pi*0.03}s both">
            <div class="proc-card2-left">
              <div class="proc-card2-num" style="background:${g.color}${done?'':'18'};color:${done?'#fff':g.color};${done?`border-color:${g.color}`:''}">
                ${done?'✓':p.id.replace('P','')}
              </div>
            </div>
            <div class="proc-card2-body">
              <div class="proc-card2-nm">${p.nm}</div>
              <div class="proc-card2-ref">${p.ref}${p.duree?` · ⏱ ${p.duree.split('.')[0]}`:''}${p.piege?' · ⚠️':''}</div>
            </div>
            <div class="proc-card2-arr" style="color:${done?'var(--gold)':'var(--t3)'}">›</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });
  el.innerHTML=html;
}


/* ─── DÉFI QUOTIDIEN ─── */
const DEFI={
  getTodayKey(){return new Date().toDateString();},
  getSeed(){const d=new Date();return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();},
  pick(){
    const seed=DEFI.getSeed();
    const ficheIdx=seed%FB.length;
    const qPool=QB.filter(q=>q.diff>=2);
    const theme=(qPool[seed%qPool.length]||QB[0]).cat;
    return{fiche:FB[ficheIdx],theme};
  },
  isDone(){return S.defi?.lastDate===DEFI.getTodayKey()&&S.defi?.done;},
  markDone(){S.defi={lastDate:DEFI.getTodayKey(),done:true};save();DEFI.renderWidget();},
  getCountdown(){
    const now=new Date();const midnight=new Date(now);midnight.setHours(24,0,0,0);
    const diff=midnight-now;const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000);
    return`${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}`;
  },
  renderWidget(){
    const el=document.getElementById('h-defi-widget');if(!el)return;
    const{fiche,theme}=DEFI.pick();
    const done=DEFI.isDone();
    const bonus=new Date().getHours()<22;
    el.innerHTML=`<div class="defi-card${done?' defi-done':''}">
      <div class="defi-badge">${done?'✅ ACCOMPLI':'🎯 DÉFI DU JOUR'}${bonus&&!done?' · <span style="color:var(--gold)">⚡ XP×2 avant 22h</span>':''}</div>
      <div class="defi-title">Infraction du jour : ${fiche.nm}</div>
      <div class="defi-sub">${done?`Prochain défi dans`:`Mémorise la fiche, puis relève le défi flash (5 QCM)`}</div>
      ${done?`<div class="defi-countdown">⏱ ${DEFI.getCountdown()}</div>`:`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <button class="btn btn-ghost btn-sm" onclick="openFiche('${fiche.id}');DEFI.markDone()">📖 Voir fiche</button>
        <button class="btn btn-p btn-sm" onclick="DEFI.startFlash('${theme}')">⚡ Défi flash</button>
      </div>`}
    </div>`;
  },
  startFlash(cat){
    DEFI.markDone();
    const bonus=new Date().getHours()<22;
    if(bonus)showToast('⚡ Bonus XP×2 activé !','ok');
    const q=QB.filter(x=>x.cat===cat).sort(()=>Math.random()-.5).slice(0,5);
    buildSession(q.length?q:QB.sort(()=>Math.random()-.5).slice(0,5));
    navigateTo('revision');
  }
};

/* ─── BADGES ─── */
const BADGE_DEFS=[
  {id:'b01',emoji:'🌟',name:'Premier Pas',desc:'Première leçon terminée',cond:()=>Object.keys(S.lessons).length>=1},
  {id:'b02',emoji:'🔒',name:'Maître de la GAV',desc:'Toutes les questions GAV réussies',cond:()=>QB.filter(q=>q.cat==='GAV').every(q=>(S.qcm.cards[q.id]?.ok||0)>0)},
  {id:'b03',emoji:'🚨',name:'Expert Flagrance',desc:'10 sessions réalisées',cond:()=>(S.user.sessionsDone||0)>=10},
  {id:'b04',emoji:'📚',name:'Encyclopédie',desc:'30 leçons vues',cond:()=>Object.keys(S.lessons).length>=30},
  {id:'b05',emoji:'🏆',name:'Semaine parfaite',desc:'Streak de 7 jours consécutifs',cond:()=>S.user.streak>=7},
  {id:'b06',emoji:'🔥',name:'Indestructible',desc:'Streak de 30 jours consécutifs',cond:()=>S.user.streak>=30},
  {id:'b07',emoji:'🎯',name:'Perfectionniste',desc:'Session QCM sans erreur (10+ questions)',cond:()=>(S.perfectSessions||0)>=1},
  {id:'b08',emoji:'⚖️',name:'Procédurier',desc:'Maîtriser les procédures de base',cond:()=>CHAPTERS.filter(c=>['ch1','ch2','ch3','ch4'].includes(c.id)).flatMap(c=>c.lessons).every(l=>S.lessons[l.id])},
  {id:'b09',emoji:'📞',name:'CR Master',desc:'CR Timer complété 10 fois',cond:()=>(S.crDone||0)>=10},
  {id:'b10',emoji:'🕵️',name:'Chasseur de Pièges',desc:'20 questions difficiles réussies',cond:()=>QB.filter(q=>q.diff===3&&(S.qcm.cards[q.id]?.ok||0)>0).length>=20},
  {id:'b11',emoji:'👑',name:'Roi des Mandats',desc:'Toutes les questions Mandats maîtrisées',cond:()=>QB.filter(q=>q.cat==='MANDATS').every(q=>(S.qcm.cards[q.id]?.ok||0)>0)},
  {id:'b12',emoji:'🏆',name:'Légende OPJ',desc:'10 000 XP atteints',cond:()=>S.user.xp>=10000},
  {id:'b13',emoji:'🧠',name:'Grand Juriste',desc:'5 000 XP atteints',cond:()=>S.user.xp>=5000},
  {id:'b14',emoji:'💡',name:'100 Questions',desc:'100 QCM réalisés',cond:()=>Object.keys(S.qcm.cards).length>=100},
  {id:'b15',emoji:'⚡',name:'Blitz Master',desc:'Score parfait au Blitz',cond:()=>(S.blitzBest||0)>=10},
  {id:'b16',emoji:'🗂️',name:'Classificateur',desc:'3 sessions Classification terminées',cond:()=>(S.classifDone||0)>=3},
  {id:'b17',emoji:'🖨️',name:'Archiviste',desc:'3 fiches imprimées',cond:()=>(S.printDone||0)>=3},
  {id:'b18',emoji:'🎓',name:'OPJ Élite',desc:'Toutes les leçons vues',cond:()=>{const t=CHAPTERS.reduce((a,c)=>a+c.lessons.length,0);return Object.keys(S.lessons).length>=t;}},
  {id:'b19',emoji:'🌙',name:'Noctambule',desc:'Session réalisée après 22h',cond:()=>false},// déclenchée manuellement
  {id:'b20',emoji:'⭐',name:'500 XP',desc:'500 XP gagnés',cond:()=>S.user.xp>=500},
  // Badges oraux : dépendent de window.ORAL_QB + S.oral.done (sans module_N fantômes)
  {id:'flag_master',emoji:'🚨',name:'Maître de la Flagrance',desc:'Toutes les questions orales — Flagrance',cond:()=>{
    if(typeof window==='undefined'||window.ORAL_QB===undefined||!Array.isArray(window.ORAL_QB))return false;
    const questions=window.ORAL_QB.filter(q=>q.theme==='FLAGRANCE');
    if(questions.length===0)return false;
    const done=S.oral?.done||{};
    return questions.every(q=>!!done[q.id]);
  }},
  {id:'gav_guru',emoji:'🛡️',name:'Gardien des Droits',desc:'Toutes les questions orales — GAV',cond:()=>{
    if(typeof window==='undefined'||window.ORAL_QB===undefined||!Array.isArray(window.ORAL_QB))return false;
    const questions=window.ORAL_QB.filter(q=>q.theme==='GAV');
    if(questions.length===0)return false;
    const done=S.oral?.done||{};
    return questions.every(q=>!!done[q.id]);
  }},
  {id:'cdo_specialist',emoji:'🎯',name:'Chasseur de CDO',desc:'Toutes les questions orales — TSE / CO (thème TSE + série oral_m07)',cond:()=>{
    if(typeof window==='undefined'||window.ORAL_QB===undefined||!Array.isArray(window.ORAL_QB))return false;
    const seen=new Set();
    const questions=window.ORAL_QB.filter(q=>{
      if(!(q.theme==='TSE'||/^oral_m07/.test(q.id)))return false;
      if(seen.has(q.id))return false;
      seen.add(q.id);
      return true;
    });
    if(questions.length===0)return false;
    const done=S.oral?.done||{};
    return questions.every(q=>!!done[q.id]);
  }},
  {id:'pv_writer',emoji:'✍️',name:'Rédacteur Confirmé',desc:'8 cartouches PV validées',cond:()=>(S.pvDone||0)>=8},
  {id:'triptyque_20',emoji:'📑',name:'As du Triptyque',desc:'20 fiches maîtrisées',cond:()=>{
    const fromObj=Object.values(S.fiches||{}).filter(f=>f&&f.mastered).length;
    const fromFs=(typeof FB!=='undefined'&&FB)?FB.filter(f=>S.fs[f.id]==='m').length:0;
    return Math.max(fromObj,fromFs)>=20;
  }},
  {id:'triptyque_64',emoji:'📚',name:'Encyclopédie Pénale',desc:'64 fiches maîtrisées',cond:()=>{
    const fromObj=Object.values(S.fiches||{}).filter(f=>f&&f.mastered).length;
    const fromFs=(typeof FB!=='undefined'&&FB)?FB.filter(f=>S.fs[f.id]==='m').length:0;
    return Math.max(fromObj,fromFs)>=64;
  }},
  {id:'streak_30',emoji:'🧱',name:'Discipline de Fer',desc:'Streak 30 jours',cond:()=>(S.user?.streak||0)>=30},
  {id:'streak_60',emoji:'💎',name:'Infaillible',desc:'Streak 60 jours',cond:()=>(S.user?.streak||0)>=60},
  {id:'exam_90',emoji:'🎓',name:'Prêt pour le Jury',desc:'Un examen blanc oral ≥ 90 %',cond:()=>(S.examHistory||[]).some(e=>e.scoreGlobal>=0.9)},
  {id:'early_bird',emoji:'🐦',name:'Premier Arrivé',desc:'QDJ correcte avant 9 h',cond:()=>(S.earlyBirdCount||0)>=1},
  {id:'oral_ready',emoji:'🎤',name:'Paré pour l\'Oral',desc:'3 examens blancs oraux ≥ 80 %',cond:()=>(S.examHistory||[]).filter(e=>e.scoreGlobal>=0.8).length>=3},
  {id:'all_modules',emoji:'🗂️',name:'Programme Complet',desc:'Toutes les questions du banc oral répondues',cond:()=>{
    if(typeof window==='undefined'||window.ORAL_QB===undefined||!Array.isArray(window.ORAL_QB))return false;
    const allQ=window.ORAL_QB;
    if(allQ.length===0)return false;
    const done=S.oral?.done||{};
    return allQ.every(q=>!!done[q.id]);
  }},
];

const BADGES={
  checkAll(){
    let newUnlocks=[];
    for(const b of BADGE_DEFS){
      if(!S.badges[b.id]){
        try{if(b.cond()){S.badges[b.id]=Date.now();newUnlocks.push(b);}}catch(e){}
      }
    }
    if(newUnlocks.length){save();newUnlocks.forEach((b,i)=>setTimeout(()=>BADGES.showModal(b),i*1400));}
  },
  showModal(b){
    try{AudioFX.badge();}catch(e){}
    const ov=document.getElementById('badge-unlock-ov');if(!ov)return;
    const _be=document.getElementById('bul-emoji');if(_be)_be.textContent=b.emoji;
    const _bn=document.getElementById('bul-name');if(_bn)_bn.textContent=b.name;
    const _bd=document.getElementById('bul-desc');if(_bd)_bd.textContent=b.desc;
    ov.style.display='flex';
    ov.classList.add('show','badge-unlock--spectacular');
    setTimeout(()=>ov.classList.remove('badge-unlock--spectacular'),900);
    confetti(true);
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      [[523,.1],[659,.2],[784,.3]].forEach(([freq,t])=>{
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.connect(g);g.connect(ctx.destination);
        o.frequency.value=freq;g.gain.setValueAtTime(.2,ctx.currentTime+t);
        g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+t+.3);
        o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+.4);
      });
    }catch(e){}
  },
  closeModal(){const ov=document.getElementById('badge-unlock-ov');if(ov){ov.style.display='none';ov.classList.remove('show');}},
  onBadgeTap(id){
    const b=BADGE_DEFS.find(x=>x.id===id);if(!b)return;
    if(S.badges[id])return;
    showToast('🔒 Condition : '+b.desc,'ok');
  },
  renderGrid(){
    const grid=document.getElementById('pr-badges-grid');if(!grid)return;
    if(!S.badgeUiSeen)S.badgeUiSeen={};
    grid.innerHTML=BADGE_DEFS.map(b=>{
      const unlocked=!!S.badges[b.id];
      let pop='';
      if(unlocked&&!S.badgeUiSeen[b.id]){S.badgeUiSeen[b.id]=1;try{save();}catch(e){}pop=' badge-item--pop';}
      return`<button type="button" 
    class="badge-item ${unlocked?'unlocked':'locked'}${pop}" 
    onclick="BADGES.onBadgeTap('${b.id}')"
    title="${b.name.replace(/"/g,'&quot;')}">
    <div class="badge-circle">${b.emoji}</div>
    <div class="badge-name" style="
      font-size:8px;
      font-weight:700;
      text-align:center;
      width:100%;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      margin-top:2px;
      font-family:'JetBrains Mono',monospace;
      letter-spacing:.03em;
      text-transform:uppercase;
    ">${b.name}</div>
  </button>`;
    }).join('');
  }
};

/* ─── STREAK SHIELD ─── */
const SHIELD={
  checkOnOpen(){
    if(!S.user.name)return;
    const last=S.user.lastActivity;if(!last)return;
    const diffH=(Date.now()-new Date(last))/ 3600000;
    if(diffH>=20&&diffH<48){
      const lastEarned=S.shield?.lastEarned?new Date(S.shield.lastEarned):null;
      if(!lastEarned||(Date.now()-lastEarned)/86400000>=7){
        S.shield={count:(S.shield?.count||0)+1,lastEarned:Date.now()};save();
      }
      setTimeout(()=>SHIELD.showDanger(),1500);
    }
  },
  showDanger(){
    const ov=document.getElementById('streak-danger-ov');if(!ov)return;
    ov.style.display='flex';
    const shields=S.shield?.count||0;
    const info=document.getElementById('streak-shield-info');
    const btn=document.getElementById('use-shield-btn');
    if(info)info.innerHTML=shields>0?`<div class="shield-badge">🛡️ ${shields} bouclier${shields>1?'s':''} disponible${shields>1?'s':''}</div>`:`<div class="text-xs text-muted">Aucun bouclier — rejoue 7 jours de suite pour en gagner un</div>`;
    if(btn)btn.style.display=shields>0?'block':'none';
  },
  dismiss(){const ov=document.getElementById('streak-danger-ov');if(ov)ov.style.display='none';},
  useShield(){
    if((S.shield?.count||0)>0){
      S.shield.count--;S.user.lastActivity=new Date().toDateString();
      save();SHIELD.dismiss();showToast('🛡️ Bouclier utilisé — Streak sauvegardé !','ok');
    }
  }
};

/* ─── BLITZ VRAI/FAUX ─── */
const BLITZ_ASSERTIONS=[
  {q:"La GAV initiale est de 48h en droit commun",ans:false,expl:"24h initiales seulement. 48h = total après prolongation (art. 63 CPP)."},
  {q:"La tentative de contravention est punissable",ans:false,expl:"La tentative n'est JAMAIS punissable pour les contraventions (art. 121-5 CP)."},
  {q:"La présence du bâtonnier est obligatoire lors d'une perquisition dans un cabinet d'avocat",ans:true,expl:"Art. 56-1 CPP : présence du bâtonnier ou son délégué obligatoire."},
  {q:"La prescription d'un délit est de 6 ans depuis la loi du 27 février 2017",ans:true,expl:"La loi du 27/02/2017 a porté la prescription des délits de 3 à 6 ans."},
  {q:"En flagrance, les perquisitions sont limitées à l'horaire 6h-21h",ans:false,expl:"En flagrance, les perquisitions peuvent avoir lieu 24h/24 (art. 59 al.3 CPP)."},
  {q:"L'OPJ peut délivrer des mandats en commission rogatoire",ans:false,expl:"Seul le JI peut délivrer des mandats. L'OPJ en CR ne le peut pas."},
  {q:"La mise en examen renverse la présomption d'innocence",ans:false,expl:"La MEX ne renverse pas la présomption d'innocence. Seule une condamnation définitive le fait."},
  {q:"La GAV en matière de terrorisme peut atteindre 144 heures",ans:true,expl:"Art. 706-88-1 CPP : 144h max en terrorisme, avec JLD dès la 3e tranche."},
  {q:"Le mandat d'amener permet l'incarcération immédiate",ans:false,expl:"Le mandat d'amener conduit la personne devant le juge — pas d'incarcération. C'est le mandat de dépôt."},
  {q:"Le vol en bande organisée est un crime puni de 15 ans RC",ans:true,expl:"Art. 311-9 CP : le vol en bande organisée est un CRIME (15 ans RC). Piège classique."},
  {q:"En enquête préliminaire, la perquisition peut se faire de nuit sans accord",ans:false,expl:"En préliminaire, accord écrit OBLIGATOIRE ou autorisation JLD. Horaires 6h-21h."},
  {q:"La commission rogatoire est délivrée par le Procureur de la République",ans:false,expl:"La CR est délivrée exclusivement par le Juge d'Instruction (art. 151 CPP)."},
  {q:"La récidive légale nécessite une condamnation définitive antérieure",ans:true,expl:"Art. 132-8 CP : la récidive légale exige une condamnation pénale définitive préalable."},
  {q:"Les crimes contre l'humanité se prescrivent par 30 ans",ans:false,expl:"Les crimes contre l'humanité sont IMPRESCRIPTIBLES (art. 213-5 CP)."},
  {q:"La réitération d'infraction entraîne automatiquement le doublement des peines",ans:false,expl:"La réitération ≠ récidive légale. Pas de doublement automatique — juge apprécie librement."},
  {q:"Le droit au silence doit être notifié en audition libre",ans:true,expl:"Art. 61-1 CPP : notification obligatoire du droit au silence dès le début de l'audition libre."},
  {q:"L'avocat peut être différé jusqu'à 24h en criminalité organisée",ans:false,expl:"En CO, l'avocat peut être différé jusqu'à 48h sur autorisation du JLD (pas 24h)."},
  {q:"L'heure de départ de la GAV est l'heure d'arrivée au commissariat",ans:false,expl:"L'heure de GAV = heure d'APPRÉHENSION (art. 63 I al.3 CPP). Le transport est inclus."},
  {q:"Le contrôle judiciaire peut imposer des obligations non listées à l'art. 138 CPP",ans:false,expl:"La liste de l'art. 138 CPP est LIMITATIVE — 17 obligations, le juge ne peut en créer d'autres."},
  {q:"En enquête de flagrance, la durée initiale est de 8 jours",ans:true,expl:"Art. 53 al.1 CPP : 8 jours, prorogeable de 8 jours supplémentaires par le JLD."},
  {q:"Le meurtre se distingue des violences mortelles par l'intention de tuer",ans:true,expl:"Meurtre = animus necandi (intention de tuer). Violences mortelles (222-7) = intention de blesser seulement."},
  {q:"Le blanchiment simple est puni de 3 ans d'emprisonnement",ans:false,expl:"Blanchiment = 5 ans + 375 000 € (art. 324-1 CP). Aggravé BO : 10 ans."},
  {q:"Un mineur de 12 ans peut être placé en garde à vue",ans:false,expl:"La GAV est interdite pour les moins de 13 ans. Retenue judiciaire 12h max possible."},
  {q:"La détention provisoire est décidée par le Juge d'Instruction seul",ans:false,expl:"La DP est toujours décidée par le JLD. Le JI ne peut jamais décider seul."},
  {q:"La composition pénale s'applique aux délits punis jusqu'à 5 ans",ans:true,expl:"Art. 41-2 CPP : composition pénale applicable aux délits punis d'au maximum 5 ans."},
  {q:"Le recel est une infraction instantanée",ans:false,expl:"Le recel est une infraction CONTINUE — elle persiste tant que l'objet frauduleux est détenu."},
  {q:"Le dépistage alcoolémie est obligatoire en cas d'accident corporel",ans:true,expl:"Art. L234-3 Code route : dépistage obligatoire pour tout accident avec dommage corporel."},
  {q:"Le TAJ est le fichier national des empreintes génétiques",ans:false,expl:"Le FNAEG = profils ADN. Le TAJ = fusion STIC (PN) + JUDEX (GN) = antécédents judiciaires."},
  {q:"L'ARSE nécessite que l'infraction soit punie d'au moins 2 ans",ans:true,expl:"Art. 142-5 CPP : ARSE requiert peine minimale de 2 ans d'emprisonnement."},
  {q:"La nullité textuelle nécessite la démonstration d'un grief",ans:false,expl:"Nullité textuelle = automatique dès la violation du texte. Seule la nullité substantielle exige un grief."},
];

const BLITZ={
  _s:{idx:0,score:0,answers:[],timer:null,secs:60,queue:[]},
  start(){
    const _bro=document.getElementById('blitz-results-ov');if(_bro)_bro.style.display='none';
    const q=[...BLITZ_ASSERTIONS].sort(()=>Math.random()-.5).slice(0,10);
    BLITZ._s={idx:0,score:0,answers:[],timer:null,secs:60,queue:q};
    const _bov=document.getElementById('blitz-ov');if(_bov)_bov.classList.add('show');
    BLITZ._render();BLITZ._startTimer();
  },
  _render(){
    const{idx,queue}=BLITZ._s;if(idx>=queue.length){BLITZ._finish();return;}
    const item=queue[idx];
    const _bq=document.getElementById('blitz-question');if(_bq)_bq.textContent=item.q;
    const _bc=document.getElementById('blitz-counter');if(_bc)_bc.textContent=(idx+1)+'/'+queue.length;
    ['blitz-faux','blitz-vrai'].forEach(id=>{
      const btn=document.getElementById(id);if(!btn)return;
      btn.disabled=false;btn.className='blitz-btn '+(id==='blitz-faux'?'blitz-btn-ko':'blitz-btn-ok');
    });
  },
  _startTimer(){
    clearInterval(BLITZ._s.timer);BLITZ._s.secs=60;
    BLITZ._s.timer=setInterval(()=>{
      BLITZ._s.secs--;
      const pct=BLITZ._s.secs/60*100;
      const d=document.getElementById('blitz-timer-fill'),t=document.getElementById('blitz-timer-display');
      if(d)d.style.width=pct+'%';if(t)t.textContent=BLITZ._s.secs;
      if(BLITZ._s.secs<=0){clearInterval(BLITZ._s.timer);BLITZ._finish();}
    },1000);
  },
  answer(userAns){
    const{idx,queue}=BLITZ._s;if(idx>=queue.length)return;
    const item=queue[idx];const correct=userAns===item.ans;
    if(correct){BLITZ._s.score++;haptic(40);}else haptic([40,60,40]);
    BLITZ._s.answers.push({q:item.q,correct,ans:item.ans,expl:item.expl});
    const selId=userAns?'blitz-vrai':'blitz-faux';
    document.getElementById(selId)?.classList.add('sel');
    ['blitz-faux','blitz-vrai'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=true;});
    setTimeout(()=>{BLITZ._s.idx++;BLITZ._render();},380);
  },
  _finish(){
    clearInterval(BLITZ._s.timer);
    const{score,answers}=BLITZ._s;
    const xp=score*8+(score===10?50:0);addXP(xp);
    if(xp>0)showXPPop(xp);
    if(score>(S.blitzBest||0)){S.blitzBest=score;save();}
    const _bov2=document.getElementById('blitz-ov');if(_bov2)_bov2.classList.remove('show');
    const _bro2=document.getElementById('blitz-results-ov');if(_bro2)_bro2.style.display='flex';
    const _bre=document.getElementById('blitz-res-emoji');if(_bre)_bre.textContent=score>=8?'🏆':score>=5?'👍':'💪';
    const _brs=document.getElementById('blitz-res-score');if(_brs)_brs.textContent=score+'/10';
    const _brx=document.getElementById('blitz-res-xp');if(_brx)_brx.textContent='+'+xp+' XP';
    const _brv=document.getElementById('blitz-review');if(_brv)_brv.innerHTML=answers.map(a=>`
      <div style="background:var(--bg-1);border-left:3px solid ${a.correct?'var(--ok)':'var(--err)'};border-radius:0 var(--r-s) var(--r-s) 0;padding:8px 10px;margin-bottom:6px">
        <div class="text-xs fw-700" style="color:${a.correct?'var(--ok)':'var(--err)'}">${a.correct?'✓ CORRECT':'✗ INCORRECT'} — Réponse : ${a.ans?'VRAI':'FAUX'}</div>
        <div class="text-xs text-secondary mt8">${a.expl}</div>
      </div>`).join('');
    if(score===10)confetti(true);BADGES.checkAll();
  },
  stop(){clearInterval(BLITZ._s.timer);const _b1=document.getElementById('blitz-ov');if(_b1)_b1.classList.remove('show');const _b2=document.getElementById('blitz-results-ov');if(_b2)_b2.style.display='none';},
  backToMenu(){const _b3=document.getElementById('blitz-results-ov');if(_b3)_b3.style.display='none';backToRevision();setRevTab('entrainement');}
};

/* ─── CLASSIFY ─── */
const CLASSIF_DATA=[
  {nm:'MEURTRE',qual:'Crime'},{nm:'VOL SIMPLE',qual:'Dlit'},{nm:'VIOL',qual:'Crime'},
  {nm:'ESCROQUERIE',qual:'Dlit'},{nm:'USAGE STUPS',qual:'Dlit'},{nm:'RÉBELLION',qual:'Dlit'},
  {nm:'VOL BANDE ORG.',qual:'Crime'},{nm:'EXCÈS DE VITESSE',qual:'Contravention'},
  {nm:'ASSASSINAT',qual:'Crime'},{nm:'RECEL',qual:'Dlit'},{nm:'OUTRAGE',qual:'Dlit'},
  {nm:'ABUS DE CONFIANCE',qual:'Dlit'},{nm:'VIOLENCES ITT>8j',qual:'Dlit'},{nm:'TRAFIC STUPS',qual:'Crime'},
  {nm:'SÉQUESTRATION',qual:'Crime'},{nm:'STATIONNEMENT GÊNANT',qual:'Contravention'},
];
let _dragId=null;
const CLASSIF={
  _s:{items:[],placed:{},validated:false},
  start(){
    const pool=[...CLASSIF_DATA].sort(()=>Math.random()-.5).slice(0,8);
    CLASSIF._s={items:pool,placed:{},validated:false};
    const ov=document.getElementById('classify-ov');if(ov)ov.classList.add('show');
    document.getElementById('classif-result').style.display='none';
    document.getElementById('classif-validate-btn').style.display='none';
    CLASSIF._renderItems();
    ['Crime','Dlit','Contravention'].forEach(c=>{
      const col=document.getElementById('col-'+c);
      if(col)while(col.children.length>1)col.removeChild(col.lastChild);
    });
  },
  _renderItems(){
    const el=document.getElementById('classif-items');if(!el)return;
    el.innerHTML=CLASSIF._s.items.map(it=>{
      const sid=it.nm.replace(/[^a-z0-9]/gi,'_');
      return`<div class="classify-item" draggable="true" id="ci-${sid}"
        ondragstart="CLASSIF.dragStart(event,'${it.nm}')"
        onclick="CLASSIF._tapSelect('${it.nm}')">${it.nm}</div>`;
    }).join('');
  },
  _tapSelect(nm){
    // Mobile: tap item then tap column
    document.querySelectorAll('.classify-item').forEach(x=>x.style.outline='');
    const sid=nm.replace(/[^a-z0-9]/gi,'_');
    const el=document.getElementById('ci-'+sid);
    if(el){el.style.outline='2px solid var(--gold)';CLASSIF._selected=nm;}
  },
  dragStart(e,nm){_dragId=nm;e.dataTransfer.effectAllowed='move';},
  dragOver(e,col){e.preventDefault();document.getElementById('col-'+col)?.classList.add('drag-over');},
  dragLeave(e){e.currentTarget.classList.remove('drag-over');},
  drop(e,col){
    e.preventDefault();e.currentTarget.classList.remove('drag-over');
    const nm=_dragId||CLASSIF._selected;if(!nm)return;
    CLASSIF._place(nm,col);_dragId=null;CLASSIF._selected=null;
    document.querySelectorAll('.classify-item').forEach(x=>x.style.outline='');
  },
  _place(nm,col){
    const src=document.getElementById('ci-'+nm.replace(/[^a-z0-9]/gi,'_'));
    if(src)src.remove();
    CLASSIF._s.placed[nm]=col;
    const colEl=document.getElementById('col-'+col);
    if(colEl){
      const div=document.createElement('div');div.className='classify-item';div.textContent=nm;
      div.onclick=()=>CLASSIF._return(nm,col);colEl.appendChild(div);
    }
    const allPlaced=CLASSIF._s.items.every(it=>CLASSIF._s.placed[it.nm]);
    const btn=document.getElementById('classif-validate-btn');
    if(btn)btn.style.display=allPlaced?'block':'none';
  },
  _return(nm,col){
    const colEl=document.getElementById('col-'+col);
    if(colEl)[...colEl.children].filter(c=>c.textContent===nm).forEach(e=>e.remove());
    delete CLASSIF._s.placed[nm];
    const container=document.getElementById('classif-items');
    if(container){
      const div=document.createElement('div');div.className='classify-item';div.textContent=nm;
      div.draggable=true;div.ondragstart=e=>CLASSIF.dragStart(e,nm);
      div.onclick=()=>CLASSIF._tapSelect(nm);container.appendChild(div);
    }
    document.getElementById('classif-validate-btn').style.display='none';
  },
  validate(){
    let ok=0;const total=CLASSIF._s.items.length;
    CLASSIF._s.items.forEach(it=>{
      const placed=CLASSIF._s.placed[it.nm];
      const colEl=document.getElementById('col-'+placed);
      if(colEl){
        const itemEl=[...colEl.children].find(c=>c.textContent===it.nm);
        if(itemEl)itemEl.classList.add(placed===it.qual?'correct':'wrong');
      }
      if(placed===it.qual)ok++;
    });
    const xp=ok*5;addXP(xp);
    if(!S.classifDone)S.classifDone=0;S.classifDone++;save();
    document.getElementById('classif-result').style.display='block';
    document.getElementById('classif-res-emoji').textContent=ok===total?'🏆':ok>=total/2?'👍':'💪';
    document.getElementById('classif-res-score').innerHTML=`<span style="color:${ok===total?'var(--ok)':ok>=total/2?'var(--warn)':'var(--err)'}">${ok}/${total} correctes</span> · +${xp} XP`;
    document.getElementById('classif-validate-btn').style.display='none';
    BADGES.checkAll();
  },
  stop(){document.getElementById('classify-ov')?.classList.remove('show');}
};

/* ─── RECHERCHE GLOBALE ─── */
let _gsTimer=null;
const GS={
  onInput(val){
    clearTimeout(_gsTimer);
    const clear=document.getElementById('search-clear-btn');
    if(clear)clear.style.display=val?'block':'none';
    if(!val.trim()){GS.hide();return;}
    _gsTimer=setTimeout(()=>GS.search(val.trim()),300);
  },
  search(q){
    const ql=q.toLowerCase();const results=[];
    CHAPTERS.flatMap(c=>c.lessons).filter(l=>l.name.toLowerCase().includes(ql)||l.ref.toLowerCase().includes(ql)).slice(0,4)
      .forEach(l=>results.push({type:'lecon',icon:'📚',main:l.name,sub:l.ref,action:`openLesson('${l.id}')`}));
    QB.filter(x=>x.q.toLowerCase().includes(ql)).slice(0,3)
      .forEach(q=>results.push({type:'qcm',icon:'🎯',main:eh(q.q.slice(0,55)+(q.q.length>55?'…':'')),sub:eh(q.art),action:`startSession('${q.cat}')`}));
    FB.filter(f=>f.nm.toLowerCase().includes(ql)||f.ref.toLowerCase().includes(ql)).slice(0,3)
      .forEach(f=>results.push({type:'fiche',icon:'⚖️',main:f.nm,sub:f.ref,action:`openFiche('${f.id}')`}));
    if(typeof PB!=='undefined')PB.filter(p=>p.nm.toLowerCase().includes(ql)).slice(0,2)
      .forEach(p=>results.push({type:'proc',icon:'📋',main:p.nm,sub:p.ref,action:`PFM.open('${p.id}')`}));
    GS._render(results,q);
  },
  _render(results,q){
    const el=document.getElementById('search-results');if(!el)return;
    if(!results.length){el.innerHTML=`<div class="text-sm text-muted" style="padding:12px;text-align:center">Aucun résultat pour "${eh(q)}"</div>`;el.style.display='block';return;}
    const groups={lecon:'📚 Leçons',qcm:'🎯 QCM',fiche:'⚖️ Fiches LAME',proc:'📋 Procédures'};
    let html='';let lastType='';
    results.forEach(r=>{
      if(r.type!==lastType){html+=`<div class="sr-group-lbl">${groups[r.type]||r.type}</div>`;lastType=r.type;}
      html+=`<div class="sr-item" onclick="${r.action};GS.hide()"><span class="sr-item-icon">${r.icon}</span><div><div class="sr-item-main">${eh(r.main)}</div><div class="sr-item-sub">${eh(r.sub)}</div></div></div>`;
    });
    el.innerHTML=html;el.style.display='block';
  },
  show(){if(document.getElementById('global-search')?.value.trim())GS.search(document.getElementById('global-search').value.trim());},
  hide(){const el=document.getElementById('search-results');if(el)el.style.display='none';},
  clear(){const inp=document.getElementById('global-search');if(inp)inp.value='';const c=document.getElementById('search-clear-btn');if(c)c.style.display='none';GS.hide();}
};
document.addEventListener('keydown',e=>{
  if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){
    e.preventDefault();
    const inp=document.getElementById('global-search');if(inp){navigateTo('lecons');inp.focus();}
  }
});

/* ─── EXAMEN BLANC ─── */
const EB_SCENARIOS=[
  {
    id:'eb1',titre:'Cambriolage avec violences',
    dossier:`Le 14 novembre, à 22h30, vous êtes appelés pour un cambriolage en cours au 12 rue des Lilas. En arrivant, vous constatez qu'un individu, DUPONT Pierre, 32 ans, a pénétré par effraction dans un appartement. La victime, Mme MARTIN, 65 ans, était présente et a été bousculée violemment en tentant de s'interposer. Elle présente une fracture du poignet (ITT 21 jours). DUPONT est interpellé en possession de bijoux et d'espèces.`,
    questions:[
      {q:"Qualifiez juridiquement les faits pour DUPONT (qualification principale + aggravantes)",pts:"4 pts",corrige:"Vol avec violence ayant entraîné une incapacité totale de travail supérieure à 8 jours — Art. 311-4 2° et 311-6 CP. Aggravantes : nuit + effraction + victime vulnérable (âgée de 65 ans)."},
      {q:"Dans quel cadre d'enquête vous placez-vous et pourquoi ?",pts:"3 pts",corrige:"Enquête de flagrance — Art. 53 CPP. Critères : crime/délit vient de se commettre, l'auteur est appréhendé sur les lieux avec les objets volés."},
      {q:"Pouvez-vous placer DUPONT en GAV ? Justifiez. Quelle est la durée maximale ?",pts:"3 pts",corrige:"OUI — Art. 63 CPP. Conditions remplies : infraction punie d'emprisonnement + raisons plausibles de soupçonner + l'un des 6 objectifs de l'art. 62-2. Durée max : 48h (droit commun — 24h + 24h sur autorisation écrite et motivée du PR)."},
    ]
  },
  {
    id:'eb2',titre:'Trafic de stupéfiants',
    dossier:`Suite à 3 semaines de surveillance, votre service interpelle GARCIA Pablo, 28 ans, en possession de 500g de cocaïne conditionnée et de 8 500€ en espèces. Dans sa cave, vous découvrez du matériel de conditionnement. Son téléphone révèle des contacts réguliers avec des acheteurs. Un complice, TRAN Van, 22 ans, est interpellé avec 2g d'usage personnel.`,
    questions:[
      {q:"Qualifiez les faits pour GARCIA et pour TRAN",pts:"4 pts",corrige:"GARCIA : trafic de stupéfiants en bande organisée — Art. 222-34 CP (crime, 20 ans RC). TRAN : usage illicite de stupéfiants — Art. L3421-1 CSP (délit, 1 an + 3 750€). AFD 200€ possible pour TRAN."},
      {q:"Quelle durée de GAV peut être appliquée à GARCIA ? Qui autorise la prolongation ?",pts:"3 pts",corrige:"Criminalité organisée — Art. 706-88 CPP. Durée max : 96h. Première prolongation : PR. Au-delà de 48h : JLD obligatoire."},
      {q:"Quels actes d'investigation spéciaux peuvent être mis en œuvre ?",pts:"3 pts",corrige:"Interceptions téléphoniques (art. 100 CPP — JI en instruction, ou JLD en préliminaire via art. 706-95). Géolocalisation (PR 15j, JLD au-delà). Saisie des avoirs (art. 706-141 CPP)."},
    ]
  },
];
const EB={
  _state:{idx:0,timer:null,secs:0,answered:[]},
  start(){
    const s=EB_SCENARIOS[Math.floor(Math.random()*EB_SCENARIOS.length)];
    EB._state={scenario:s,answered:[],timer:null,secs:3600,phase:'questions'};
    document.getElementById('eb-title').textContent='Examen Blanc — '+s.titre;
    document.getElementById('eb-ov').classList.add('show');
    EB._render();EB._startTimer();
  },
  _startTimer(){
    EB._state.timer=setInterval(()=>{
      EB._state.secs--;
      const m=String(Math.floor(EB._state.secs/60)).padStart(2,'0');
      const s=String(EB._state.secs%60).padStart(2,'0');
      const el=document.getElementById('eb-timer');
      if(!el)return;
      el.textContent=m+':'+s;
      const pct=EB._state.secs/3600;
      if(pct<.10)el.className='eb-timer danger';
      else if(pct<.25)el.className='eb-timer warn';
      else el.className='eb-timer';
      if(EB._state.secs<=0){clearInterval(EB._state.timer);EB._finish();}
    },1000);
  },
  _render(){
    const s=EB._state.scenario;
    /* NOTE: s.dossier is editorial HTML content — not escaped */
    let html=`<div class="lesson-intro mb16">${s.dossier}</div>`;
    html+=`<div class="sect-label">Questions</div>`;
    html+=s.questions.map((q,i)=>`
      <div class="card mb12">
        <div class="text-xs text-accent font-mono fw-700 mb4">Question ${i+1} ${q.pts?'· '+eh(q.pts):''}</div>
        <div class="text-sm mb12" style="line-height:1.7">${eh(q.q)}</div>
        <textarea class="inp" id="eb-ans-${i}" placeholder="Votre réponse…" rows="4" style="resize:vertical;font-size:13px;line-height:1.6"></textarea>
      </div>`).join('');
    html+=`<button class="btn btn-p mt16" onclick="EB._finish()">✓ Remettre ma copie</button>`;
    document.getElementById('eb-body').innerHTML=html;
  },
  _finish(){
    clearInterval(EB._state.timer);
    const s=EB._state.scenario;
    let html=`<div class="font-title fw-900 text-2xl mb8" style="text-align:center">Copie remise !</div>`;
    html+=`<div class="text-sm text-secondary mb20" style="text-align:center">Voici les éléments de corrigé attendus</div>`;
    html+=`<div class="sect-label">Corrigé</div>`;
    html+=s.questions.map((q,i)=>{
      const ans=document.getElementById('eb-ans-'+i)?.value||'(pas de réponse)';
      return`<div class="card mb12">
        <div class="text-xs text-accent font-mono fw-700 mb4">Question ${i+1} ${q.pts?'· '+eh(q.pts):''}</div>
        <div class="text-sm mb8">${eh(q.q)}</div>
        ${ans!=='(pas de réponse)'?`<div class="lesson-block" style="margin-bottom:8px"><span class="text-xs text-muted fw-700 mb4" style="display:block">Votre réponse</span>${eh(ans)}</div>`:''}
        <div class="lesson-keys"><div class="lesson-keys-lbl">✓ Éléments attendus</div><div class="lesson-key-item">${q.corrige}</div></div>
      </div>`;
    }).join('');
    html+=`<button class="btn btn-ghost btn-full mt16" onclick="EB.stop()">← Fermer</button>`;
    document.getElementById('eb-body').innerHTML=html;
    document.getElementById('eb-timer').textContent='Terminé';
    addXP(50);showToast('+50 XP — Examen blanc réalisé !','ok');
  },
  stop(){document.getElementById('eb-ov')?.classList.remove('show');}
};

/* ─── QUALIFIE LES FAITS ─── */
const QUALIF_SCENARIOS=[
  {id:'q1',titre:'La bagarre',texte:`Jean frappe Pierre avec ses poings. Pierre présente une plaie au visage nécessitant 5 jours d'ITT selon le certificat médical. Jean agit seul, en plein jour, sans préméditation.`,questions:[
    {q:"Quelle est la qualification pénale des faits ?",c:"Violences volontaires ayant entraîné une incapacité totale de travail inférieure ou égale à 8 jours — Art. R625-1 CP (contravention 5e classe)."},
    {q:"Citez l'article applicable",c:"Art. R625-1 du Code pénal (ITT ≤ 8 jours sans aggravante = contravention)."},
    {q:"Quelle est la peine maximale ?",c:"1 500 € d'amende (contravention 5e classe). Avec aggravante = délit (art. 222-11 CP, 3 ans + 45 000€)."},
  ]},
  {id:'q2',titre:'Le sac arraché',texte:`Marie arrache le sac d'une femme âgée dans la rue en la bousculant violemment. La victime chute et se fracture le fémur (ITT 90 jours). Marie est interpellée 10 minutes plus tard à 500m.`,questions:[
    {q:"Qualifiez les faits",c:"Vol avec violence ayant entraîné une mutilation ou une infirmité permanente — Art. 311-4 2° et 311-6 al.2 CP (crime si ITT > 8 jours avec violence grave — peut aussi qualifier violences volontaires)."},
    {q:"Dans quel cadre d'enquête vous placez-vous ?",c:"Enquête de flagrance — Art. 53 CPP. Critères : faits viennent de se commettre, auteur interpellé peu après, clameur publique possible."},
    {q:"Pouvez-vous procéder à une perquisition au domicile de Marie sans son accord ?",c:"OUI en flagrance — Art. 56 CPP — sans accord ni horaire imposé. Si basculement en préliminaire : accord écrit ou autorisation JLD nécessaire."},
  ]},
  {id:'q3',titre:'La tromperie',texte:`Paul se fait passer pour un représentant d'assurance et convainc Mme DURAND, 78 ans, de signer un contrat bidon en lui remettant 3 000€. Mme DURAND découvre la tromperie le lendemain.`,questions:[
    {q:"Qualification juridique",c:"Escroquerie au préjudice d'une personne vulnérable — Art. 313-1 CP + aggravante art. 313-2 (vulnérabilité âge). Peine de base : 5 ans + 375k€, aggravée : 7 ans + 750k€."},
    {q:"Quels sont les éléments constitutifs ?",c:"Élément légal : art. 313-1 CP. Élément matériel : tromperie par fausse qualité (faux représentant) ayant déterminé la remise. Élément moral : intentionnel, conscience de tromper."},
    {q:"Est-ce un crime, un délit ou une contravention ?",c:"DÉLIT (art. 313-1 CP) — jugé par le Tribunal Correctionnel. Sauf si aggravantes qualifiantes qui ne le transforment pas en crime."},
  ]},
  {id:'q4',titre:'La voiture incendiée',texte:`Marc met délibérément le feu à la voiture de son voisin, garée dans la rue, causant des dommages totaux (véhicule détruit, valeur 15 000€). Aucun blessé. Marc est identifié par 3 témoins.`,questions:[
    {q:"Qualification des faits",c:"Destruction, dégradation et détérioration d'un bien appartenant à autrui commise par un moyen dangereux pour les personnes — Art. 322-6 CP (crime, 10 ans + 150 000€)."},
    {q:"Pourquoi s'agit-il d'un crime ?",c:"Le moyen employé (incendie) est dangereux pour les personnes — art. 322-6 CP élève la qualification à crime même si aucun blessé. Piège : sans moyen dangereux, simple délit (art. 322-1 CP, 2 ans)."},
    {q:"Devant quelle juridiction Marc sera-t-il jugé ?",c:"Devant la Cour d'Assises (crime). Si correctionnalisation admise par toutes les parties : Tribunal Correctionnel."},
  ]},
  {id:'q5',titre:'Le faux document',texte:`Ahmed présente un permis de conduire falsifié lors d'un contrôle routier. L'analyse révèle que le document est un faux. Ahmed reconnaît avoir acheté ce document 300€.`,questions:[
    {q:"Qualification des faits",c:"Usage de faux document administratif — Art. 441-2 CP (usage de faux = 3 ans + 45k€). La fabrication ou l'achat de faux (possession) = détention de faux (art. 441-3 CP)."},
    {q:"S'agit-il d'un crime ou d'un délit ?",c:"DÉLIT (art. 441-2 CP pour l'usage). Le faux en écriture publique ou authentique serait un crime (art. 441-1 al.2 CP). Le permis de conduire = document administratif public → délit."},
    {q:"Quelles pièces devez-vous saisir ?",c:"Le faux document (scellé immédiatement). Le téléphone si transactions visibles. Les 300€ liés à l'achat. PV de saisie dressé."},
  ]},
];
const QUALIF={
  _s:{idx:0,queue:[],score:0,phase:'question',qIdx:0},
  start(){
    const q=[...QUALIF_SCENARIOS].sort(()=>Math.random()-.5).slice(0,3);
    QUALIF._s={idx:0,queue:q,score:0,phase:'question',qIdx:0};
    document.getElementById('qualif-ov').classList.add('show');
    QUALIF._render();
  },
  _render(){
    const{idx,queue,qIdx}=QUALIF._s;
    if(idx>=queue.length){QUALIF._finish();return;}
    const sc=queue[idx];
    const q=sc.questions[qIdx];
    document.getElementById('qualif-counter').textContent=(idx+1)+'/'+queue.length+' — Q'+(qIdx+1)+'/'+sc.questions.length;
    /* NOTE: sc.texte, q.c are editorial content blocks — not escaped */
    let html=`<div class="card card-accent mb12">
      <div class="text-xs text-accent font-mono fw-700 mb4">📋 SCÉNARIO ${idx+1}</div>
      <div class="fw-700 mb8">${eh(sc.titre)}</div>
      <div class="qualif-scenario">${sc.texte}</div>
    </div>`;
    html+=`<div class="text-sm fw-700 mb8">Question ${qIdx+1} :</div>`;
    html+=`<div class="card mb12"><div style="line-height:1.7;font-size:13px">${eh(q.q)}</div></div>`;
    if(QUALIF._s.phase==='question'){
      html+=`<textarea class="inp mb12" id="qualif-ans" placeholder="Votre réponse juridique…" rows="4" style="resize:vertical;font-size:13px"></textarea>`;
      html+=`<button class="btn btn-p" onclick="QUALIF._showCorrection()">Voir le corrigé →</button>`;
    }else{
      const ans=QUALIF._s.lastAns||'';
      if(ans)html+=`<div class="lesson-block mb12"><div class="text-xs text-muted fw-700 mb4">Votre réponse</div>${eh(ans)}</div>`;
      html+=`<div class="lesson-keys mb16"><div class="lesson-keys-lbl">✓ Éléments de réponse</div><div class="lesson-key-item">${q.c}</div></div>`;
      html+=`<button class="btn btn-p" onclick="QUALIF._next()">Question suivante →</button>`;
    }
    document.getElementById('qualif-body').innerHTML=html;
  },
  _showCorrection(){
    QUALIF._s.lastAns=document.getElementById('qualif-ans')?.value||'';
    QUALIF._s.phase='correction';QUALIF._render();
  },
  _next(){
    const sc=QUALIF._s.queue[QUALIF._s.idx];
    QUALIF._s.qIdx++;QUALIF._s.phase='question';
    if(QUALIF._s.qIdx>=sc.questions.length){QUALIF._s.idx++;QUALIF._s.qIdx=0;}
    QUALIF._render();
  },
  _finish(){
    addXP(40);showToast('+40 XP — Qualification des faits !','ok');
    document.getElementById('qualif-body').innerHTML=`<div style="text-align:center;padding:32px">
      <div style="font-size:52px;margin-bottom:12px">⚖️</div>
      <div class="font-title fw-900 text-2xl mb8">Session terminée !</div>
      <div class="text-sm text-secondary mb24">Excellente pratique de qualification des faits.</div>
      <button class="btn btn-p mb8" onclick="QUALIF.start()">🔄 Nouveau scénario</button>
      <button class="btn btn-ghost btn-full" onclick="QUALIF.stop()">← Fermer</button>
    </div>`;
  },
  stop(){document.getElementById('qualif-ov')?.classList.remove('show');}
};

/* ─── UTILS ─── */
function haptic(p){if(!S.settings?.haptics)return;try{if(navigator.vibrate)navigator.vibrate(Array.isArray(p)?p:[p]);}catch(e){}}
function computeMastery(cat){
  const pool=QB.filter(q=>q.cat===cat);if(!pool.length)return{mastery:0,total:0,done:0,due:0,ok:0};
  const done=pool.filter(q=>(S.qcm?.cards?.[q.id]?.reps||0)>0);
  const ok=done.filter(q=>(S.qcm?.cards?.[q.id]?.ok||0)>0);
  const due=pool.filter(q=>{const c=S.qcm?.cards?.[q.id];return!c||c.due<=Date.now();}).length;
  const mastery=done.length?Math.round(ok.length/done.length*100):0;
  return{mastery,total:pool.length,done:done.length,due,ok:ok.length};
}
function showToast(msg,type=''){
  const ctr=document.getElementById('toast-ctr');if(!ctr)return;
  const el=document.createElement('div');
  el.className='toast '+(type||'');
  el.textContent=msg;
  el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'err' ? 'assertive' : 'polite');
  ctr.appendChild(el);setTimeout(()=>el.remove(),3000);
}
/* confetti() — version unique définie plus bas (l.~5324) */
function initOffline(){const b=document.getElementById('offline-bar');if(!b)return;const u=()=>b.style.display=!navigator.onLine?'block':'none';u();window.addEventListener('online',u);window.addEventListener('offline',u);}
function initFAB(){const fab=document.getElementById('fab');if(!fab)return;fab.onclick=()=>window.scrollTo({top:0,behavior:(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)?'auto':'smooth'});window.addEventListener('scroll',()=>fab.classList.toggle('vis',window.scrollY>250),{passive:true});}
// manifest is static (manifest.json)
/* ═══════════════════════════════════════════════════════════════════════════
   AUTH UI FUNCTIONS — Gestion de l'interface d'authentification
   ═══════════════════════════════════════════════════════════════════════════ */

function showAuthTab(tab) {
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  const loginForm = document.getElementById('auth-login');
  const signupForm = document.getElementById('auth-signup');
  
  if (tab === 'login') {
    loginTab.style.background = 'var(--accent)';
    loginTab.style.color = '#fff';
    signupTab.style.background = 'transparent';
    signupTab.style.color = 'var(--t2)';
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
  } else {
    signupTab.style.background = 'var(--accent)';
    signupTab.style.color = '#fff';
    loginTab.style.background = 'transparent';
    loginTab.style.color = 'var(--t2)';
    signupForm.style.display = 'block';
    loginForm.style.display = 'none';
  }
}

async function handleLogin() {
  const email = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  
  if (!email || !email.includes('@')) {
    showToast('Email invalide', 'err');
    return;
  }
  if (!password || password.length < 6) {
    showToast('Mot de passe trop court', 'err');
    return;
  }
  
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Connexion...';
  
  const { data, error } = await AUTH.login(email, password);
  
  if (error) {
    showToast('Erreur: ' + error.message, 'err');
    btn.disabled = false;
    btn.textContent = 'Se connecter →';
    return;
  }
  
  // Charger la progression depuis Supabase
  await SYNC.loadProgress();
  S.page = 'home';
  save();
  
  finishAuth(S.user.name || 'Officier');
}

async function handleSignup() {
  const name = document.getElementById('signup-name')?.value?.trim() || 'Officier';
  const email = document.getElementById('signup-email')?.value?.trim();
  const password = document.getElementById('signup-password')?.value;
  const examDate = document.getElementById('signup-date')?.value || '2026-06-15';
  
  if (!email || !email.includes('@')) {
    showToast('Email invalide', 'err');
    return;
  }
  if (!password || password.length < 6) {
    showToast('Mot de passe min. 6 caractères', 'err');
    return;
  }
  
  const btn = document.getElementById('btn-signup');
  btn.disabled = true;
  btn.textContent = 'Création...';
  
  const { data, error } = await AUTH.signup(email, password, name);
  
  if (error) {
    showToast('Erreur: ' + error.message, 'err');
    btn.disabled = false;
    btn.textContent = 'Créer mon compte →';
    return;
  }
  
  // Mettre à jour le state local
  S.user.name = name;
  S.user.examDate = examDate;
  S.page = 'home';
  
  // Sauvegarder le profil
  if (currentUser) {
    await SYNC.updateProfile(name, examDate);
  }
  
  save();
  showToast('✅ Compte créé ! Vérifiez votre email.', 'ok');
  
  // Si auto-confirm activé, on continue directement
  if (data.session) {
    finishAuth(name);
  } else {
    btn.disabled = false;
    btn.textContent = 'Créer mon compte →';
    showAuthTab('login');
  }
}

async function handleMagicLink() {
  const email = document.getElementById('login-email')?.value?.trim();
  
  if (!email || !email.includes('@')) {
    showToast('Entrez votre email d\'abord', 'err');
    return;
  }
  
  const { error } = await AUTH.magicLink(email);
  
  if (error) {
    showToast('Erreur: ' + error.message, 'err');
    return;
  }
  
  showToast('📧 Lien envoyé ! Vérifiez votre boîte mail.', 'ok');
}

function startOfflineMode() {
  const name = 'Officier';
  S.user.name = name;
  S.user.examDate = '2026-06-15';
  S.page = 'home';
  S._offlineMode = true;
  save();
  finishAuth(name);
}

function finishAuth(name) {
  S.user.name = name || S.user.name || 'Officier';
  S.page = 'home';
  save();

  const onb = document.getElementById('onboarding');
  const app = document.getElementById('app');
  if (onb) onb.style.display = 'none';
  if (app) { app.style.display = 'flex'; app.style.flexDirection = 'column'; }
  const _bn = document.getElementById('bnav'); if (_bn) _bn.style.display = 'flex';
  
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.style.display = currentUser ? 'flex' : 'none';
  }
  
  const syncStatus = document.getElementById('sync-status');
  if (syncStatus) {
    syncStatus.textContent = currentUser ? 'Cloud ☁️' : 'Local';
  }
  
  try { updateStreak(); } catch(e) {}
  try { navigateTo('home'); } catch(e) {}
  try { showToast('Bienvenue ' + S.user.name + ' ! 🎯', 'ok'); } catch(e) {}
  try { BADGES.checkAll(); } catch(e) {}
  try { renderMotivBanner(); } catch(e) {}
}

function showAuthScreen() {
  const _onb=document.getElementById('onboarding');if(_onb)_onb.style.display='flex';
  const _app=document.getElementById('app');if(_app)_app.style.display='none';
}

function showAccountModal() {
  const email = currentUser?.email || 'Mode hors-ligne';
  const syncStatus = currentUser ? '☁️ Synchronisé' : '📴 Local uniquement';
  
  const html = `<div style="padding:18px">
    <div class="font-title fw-800 text-xl mb16">👤 Mon compte</div>
    <div style="background:var(--bg-2);border-radius:var(--r-m);padding:14px;margin-bottom:16px">
      <div class="flex-b mb8">
        <span style="color:var(--t3);font-size:12px">Email</span>
        <span style="color:var(--t1);font-size:13px;font-weight:600">${eh(email)}</span>
      </div>
      <div class="flex-b mb8">
        <span style="color:var(--t3);font-size:12px">Statut</span>
        <span style="color:var(--ok);font-size:13px;font-weight:600">${syncStatus}</span>
      </div>
      <div class="flex-b">
        <span style="color:var(--t3);font-size:12px">Abonnement</span>
        <span style="color:${S.isPro?'var(--gold)':'var(--t2)'};font-size:13px;font-weight:600">${S.isPro?'PRO 👑':'Gratuit'}</span>
      </div>
    </div>
    ${currentUser ? `
    <button class="btn btn-ghost btn-full mb8" onclick="forceSyncNow()">🔄 Forcer la synchronisation</button>
    <button class="btn btn-full mb8" style="background:var(--err-bg);color:var(--err)" onclick="AUTH.logout();closeLesson()">🚪 Se déconnecter</button>
    ` : `
    <button class="btn btn-p btn-full mb8" onclick="closeLesson();showAuthScreen();showAuthTab('login')">🔐 Se connecter</button>
    `}
    <button class="btn btn-ghost btn-full" onclick="closeLesson()">Fermer</button>
  </div>`;
  
  document.getElementById('lesson-modal-body').innerHTML = html;
  document.getElementById('lesson-ov').classList.add('on');
  document.body.style.overflow = 'hidden';
}

async function forceSyncNow() {
  if (!currentUser) {
    showToast('Non connecté', 'err');
    return;
  }
  showToast('Synchronisation...', 'ok');
  const ok = await SYNC.saveProgress();
  if (ok) {
    showToast('✅ Synchronisé !', 'ok');
  } else {
    showToast('❌ Erreur de sync', 'err');
  }
}

// Legacy support - rediriger vers le nouveau système
function finishOnboarding(){
  startOfflineMode();
}

/* renderFSRSDueWidget supprimé — legacy compat */

/* ─── BOOT ─── */
(async function boot(){
  const vEl = document.getElementById('app-version-display');
  if (vEl) vEl.textContent = APP_CONFIG?.APP_VERSION || 'v61';
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.origin !== window.location.origin) return;
    if (e.data.type === 'auth') {
      window.finishAuth(e.data.name || 'Officier');
    }
    if (e.data.type === 'offline') {
      window.startOfflineMode();
    }
  });
  window._authBridge = function(name) {
    window.finishAuth(name);
  };
  loadState();initOffline();initFAB();
  try{initExamenBlancDelegation();}catch(e){console.warn('initExamenBlancDelegation',e);}
  try{initJourJDelegation();}catch(e){console.warn('initJourJDelegation',e);}
  if(!window._opjVisBound){
    window._opjVisBound=true;
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState!=='hidden')return;
      try{
        if(typeof S!=='undefined'&&S){S.lastBgAt=Date.now();if(typeof save==='function')save();}
      }catch(e){}
    });
  }
  THEME28.apply();
  
  // Initialiser Supabase
  const supabaseReady = initSupabase();
  
  /* ── Fonction utilitaire : afficher l'app, masquer l'onboarding ── */
  function _showApp(){
    const _onb=document.getElementById('onboarding');if(_onb)_onb.style.display='none';
    const _app=document.getElementById('app');if(_app){_app.style.display='flex';_app.style.flexDirection='column';}
    const _bn=document.getElementById('bnav');if(_bn)_bn.style.display='flex';
  }
  function _bootLocal(){
    const hasProgress=(S.user.name&&S.user.name!=='OPJ')||S.user.xp>0||Object.keys(S.qcm?.cards||{}).length>0;
    if(hasProgress&&S.page==='onboarding'){S.page='home';save();}
    if(S.page!=='onboarding'){
      _showApp();
      try{updateStreak();}catch(e){}
      navigateTo('home');
      window.addEventListener('load',()=>{try{SHIELD.checkOnOpen();BADGES.checkAll();}catch(e){}},{ once:true });
    }
  }

  if (supabaseReady) {
    let session=null;
    try{
      session = await AUTH.getSession();
    }catch(e){console.warn('[OPJ] getSession failed:',e);}
    
    if (session?.user) {
      currentUser = session.user;
      console.log('[OPJ] Session trouvée:', currentUser.email);
      try{await SYNC.loadProgress();}catch(e){console.warn('[OPJ] sync failed:',e);}
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success') {
        try{await STRIPE.checkProStatus();}catch(e){}
        save();
        showToast('Abonnement activé ! Bienvenue dans OPJ Elite PRO', 'ok');
        window.history.replaceState({}, '', window.location.pathname);
      }
      S.page = 'home';
      _showApp();
      const btnLogout = document.getElementById('btn-logout');
      if (btnLogout) btnLogout.style.display = 'flex';
      const syncStatus = document.getElementById('sync-status');
      if (syncStatus) syncStatus.textContent = 'Cloud';
      try{updateStreak();}catch(e){}
      navigateTo('home');
      window.addEventListener('load',()=>{try{SHIELD.checkOnOpen();BADGES.checkAll();}catch(e){}},{ once:true });
    } else {
      _bootLocal();
    }
    
    try{
      AUTH.onAuthChange(async (event, session) => {
        console.log('[OPJ] Auth event:', event);
        if (event === 'SIGNED_IN' && session?.user) {
          currentUser = session.user;
          try{await SYNC.loadProgress();}catch(e){}
          S.page = 'home';
          save();
          finishAuth(S.user.name || 'Officier');
        } else if (event === 'SIGNED_OUT') {
          currentUser = null;
          showAuthScreen();
        }
      });
    }catch(e){console.warn('[OPJ] onAuthChange setup failed:',e);}
  } else {
    _bootLocal();
  }
  
  // Raccourci clavier / pour recherche
  document.addEventListener('keydown',e=>{
    if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
      e.preventDefault();document.getElementById('global-search')?.focus();
    }
  });
  setTimeout(()=>{try{if(typeof NOTIF!=='undefined')NOTIF.init();}catch(_){}},800);
})();


// ═══════════════════════════════════════════════════════
// PREMIUM UX — micro-interactions & messages motivants
// ═══════════════════════════════════════════════════════

// Messages de motivation dynamiques
const MOTIV_MSGS = [
  {min:0,   max:100,  icon:'🎯', msg:"Chaque question compte. Tu construis ton futur grade."},
  {min:100, max:300,  icon:'🔥', msg:"L'élan est lancé ! Tes efforts commencent à payer."},
  {min:300, max:600,  icon:'⚡', msg:"Tu progresses vite. Le jury remarquera ta précision."},
  {min:600, max:1000, icon:'🏆', msg:"Niveau solide. Tu maîtrises les bases procédurales."},
  {min:1000,max:2000, icon:'⚖️', msg:"Niveau OPJ confirmé. Continue ta domination."},
  {min:2000,max:99999,icon:'👑', msg:"Élite. Tu es dans le top des candidats OPJ de France."},
];

function getMotivMsg(xp){
  return MOTIV_MSGS.find(m=>xp>=m.min&&xp<m.max)||MOTIV_MSGS[0];
}

// Injecter le message motivant dans la home
function renderMotivBanner(){
  const el=document.getElementById('h-motiv-banner');
  if(!el)return;
  const m=getMotivMsg(S.user.xp||0);
  el.innerHTML=`<span style="font-size:15px">${m.icon}</span><span style="font-size:12px;color:var(--t2);line-height:1.5">${m.msg}</span>`;
}

/* animCountUp supprimé — jamais appelé */

/* haptic() défini plus haut (l.4976) — suppression du doublon */

// Confetti amélioré
function confetti(intense=true){
  const cv=document.getElementById('confetti-cv');if(!cv)return;
  const ctx=cv.getContext('2d');
  cv.width=window.innerWidth;cv.height=window.innerHeight;
  cv.style.display='block';
  const particles=Array.from({length:intense?80:40},()=>({
    x:Math.random()*cv.width, y:-10,
    vx:(Math.random()-.5)*6, vy:Math.random()*4+2,
    r:Math.random()*5+2, a:Math.random()*360,
    va:(Math.random()-.5)*8,
    color:['#2563eb','#3b82f6','#d4af37','#10b981','#8b5cf6','#f59e0b'][Math.floor(Math.random()*6)]
  }));
  let frame=0;
  const draw=()=>{
    ctx.clearRect(0,0,cv.width,cv.height);
    particles.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;p.a+=p.va;p.vy+=.08;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a*Math.PI/180);
      ctx.fillStyle=p.color;ctx.globalAlpha=Math.max(0,1-frame/120);
      ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r);
      ctx.restore();
    });
    if(++frame<120)requestAnimationFrame(draw);
    else{ctx.clearRect(0,0,cv.width,cv.height);cv.style.display='none';}
  };
  requestAnimationFrame(draw);
}

// [v30 override supprimé — logique intégrée dans renderHome()]




/* ============================================================
   OPJ ELITE — PATCH v2.0
   Missions · Combo · Plan d'étude · Onboarding · FSRS · CSS fixes
   ============================================================ */
(function () {
  'use strict';

  /* CSS INJECTION */
  const CSS = `
    .bubble-grid {
      display:grid !important;
      grid-template-columns:repeat(3,1fr) !important;
      gap:6px !important;
      padding:0 !important;
      box-sizing:border-box !important;
      width:100% !important;
      overflow:hidden !important;
    }
    .hero-kl    { font-size:10px !important; }
    .bubble-name{ font-size:10px !important; }
    .bubble-tag { font-size:9px  !important; }

    @keyframes flamePulse {
      0%,100%{ transform:scale(1) rotate(-3deg); filter:drop-shadow(0 0 4px #f59e0b); }
      50%    { transform:scale(1.15) rotate(3deg); filter:drop-shadow(0 0 14px #ef4444); }
    }
    .streak-flame{ display:inline-block; animation:flamePulse 1.8s ease-in-out infinite; }

    @keyframes comboPop {
      from{ transform:translateX(-50%) scale(.7); opacity:0; }
      to  { transform:translateX(-50%) scale(1);  opacity:1; }
    }
    .combo-hud{
      position:fixed; top:calc(var(--hdr-h) + var(--safe-t) + 10px);
      left:50%; transform:translateX(-50%); z-index:500; pointer-events:none;
      display:flex; align-items:center; gap:6px;
      background:rgba(212,175,55,.18); border:1px solid rgba(212,175,55,.4);
      border-radius:100px; padding:5px 16px;
      font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:700; color:var(--gold);
      animation:comboPop .3s var(--tr-spring); backdrop-filter:blur(12px);
    }

    .missions-card{
      background:var(--bg-1); border:1px solid var(--brd);
      border-radius:var(--r-xl); padding:14px; margin-bottom:12px;
    }
    .missions-hd{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .missions-title{ font-size:10px; font-weight:800; color:var(--t3);
      text-transform:uppercase; letter-spacing:.1em; display:flex; align-items:center; gap:6px; }
    .missions-score{ font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--gold); font-weight:700; }
    .mission-row{
      display:flex; align-items:center; gap:10px; padding:10px 11px;
      background:var(--bg-2); border-radius:var(--r-m); margin-bottom:7px; transition:all var(--tr);
      border:1px solid var(--brd);
    }
    .mission-row.done{ background:var(--ok-bg); border:1px solid rgba(16,185,129,.22); opacity:.88; }
    .mission-row--flash{ animation:missionRowFlash .85s cubic-bezier(.34,1.3,.64,1); }
    @keyframes missionRowFlash{
      0%{ box-shadow:0 0 0 0 rgba(16,185,129,.5); transform:scale(1); }
      40%{ box-shadow:0 0 0 6px rgba(16,185,129,.15); transform:scale(1.01); }
      100%{ box-shadow:0 0 0 0 transparent; transform:scale(1); }
    }
    .mission-ico-wrap{
      width:36px;height:36px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
      font-size:17px;line-height:1;
      box-shadow:0 2px 10px rgba(0,0,0,.25);
    }
    .mission-ico{ font-size:16px; flex-shrink:0; }
    .mission-inf{ flex:1; min-width:0; }
    .mission-name{ font-size:12px; font-weight:600; color:var(--t1); }
    .mission-row.done .mission-name{ color:var(--ok); text-decoration:line-through; }
    .mission-sub{ font-size:9px; color:var(--t3); margin-top:2px; font-family:'JetBrains Mono',monospace; }
    .mission-bar{ height:4px; background:var(--bg-3); border-radius:100px; overflow:hidden; margin-top:5px; position:relative; }
    .mission-bar::after{ content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent); animation:missionShine 2.2s ease-in-out infinite; pointer-events:none; opacity:.5; }
    @keyframes missionShine{ 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
    .mission-bar-fill{
      height:100%; border-radius:100px; background:linear-gradient(90deg,var(--accent),var(--accent-l));
      transition:width .7s cubic-bezier(.34,1.25,.64,1);
      box-shadow:0 0 10px rgba(77,143,255,.35);
    }
    .mission-row.done .mission-bar-fill{ background:linear-gradient(90deg,#10b981,#34d399); box-shadow:0 0 8px rgba(16,185,129,.35); }
    .mission-row--flash .mission-check{ animation:missionCheckPop .55s cubic-bezier(.34,1.56,.64,1); }
    @keyframes missionCheckPop{ from{ transform:scale(0) rotate(-45deg); opacity:0 } to{ transform:scale(1) rotate(0); opacity:1 } }
    .mission-check{ display:none; font-size:14px; margin-right:2px; }
    .mission-row.done .mission-check{ display:inline; }
    .mission-xp{ font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--gold); font-weight:700; flex-shrink:0; }

    .sp-card{
      background:var(--bg-1); border:1px solid rgba(37,99,235,.28);
      border-radius:var(--r-xl); padding:14px; margin-bottom:12px;
      position:relative; overflow:hidden;
    }
    .sp-card::before{
      content:''; position:absolute; inset:0;
      background:linear-gradient(135deg,rgba(37,99,235,.05),transparent); pointer-events:none;
    }
    .sp-header{ font-size:10px; font-weight:800; color:var(--t3);
      text-transform:uppercase; letter-spacing:.1em;
      margin-bottom:10px; display:flex; align-items:center; gap:6px; }
    .phase-banner{
      display:flex; align-items:center; gap:12px;
      background:linear-gradient(135deg,rgba(37,99,235,.1),rgba(212,175,55,.07));
      border:1px solid rgba(212,175,55,.2); border-radius:var(--r-m);
      padding:10px 13px; margin-bottom:10px;
    }
    .phase-icon{ font-size:22px; flex-shrink:0; }
    .phase-inf{ flex:1; }
    .phase-lbl{ font-size:9px; font-weight:800; color:var(--gold);
      font-family:'JetBrains Mono',monospace; text-transform:uppercase; letter-spacing:.09em; }
    .phase-txt{ font-size:12px; color:var(--t1); font-weight:600; margin-top:1px; }
    .phase-days{ text-align:center; flex-shrink:0; }
    .phase-days-n{ font-family:'JetBrains Mono',monospace; font-size:22px; font-weight:700; color:var(--gold); line-height:1; }
    .phase-days-l{ font-size:7px; color:var(--t3); text-transform:uppercase; letter-spacing:.06em; }
    .sp-row{
      display:flex; align-items:center; gap:10px; padding:10px 11px;
      background:rgba(37,99,235,.05); border:1px solid rgba(37,99,235,.12);
      border-radius:var(--r-m); margin-bottom:6px; cursor:pointer; transition:all var(--tr);
    }
    .sp-row:hover,.sp-row:active{ background:rgba(37,99,235,.1); transform:scale(.997); }
    .sp-row-ico{ font-size:19px; flex-shrink:0; }
    .sp-row-inf{ flex:1; min-width:0; }
    .sp-row-name{ font-size:12px; font-weight:600; color:var(--t1); }
    .sp-row-sub{ font-size:9px; color:var(--t3); margin-top:2px; font-family:'JetBrains Mono',monospace; }
    .sp-row-pct{ font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; flex-shrink:0; }

    @keyframes onbPop {
      from{ transform:scale(.6); opacity:0; }
      to  { transform:scale(1);  opacity:1; }
    }
    .onb2-ov{
      position:fixed; inset:0; background:var(--bg-0); z-index:900;
      display:flex; align-items:center; justify-content:center;
      padding:28px; animation:pgIn .35s ease;
    }
    .onb2-wrap{ width:100%; max-width:380px; text-align:center; }
    .onb2-icon{ font-size:72px; margin-bottom:16px; animation:onbPop .4s var(--tr-spring); display:block; }
    .onb2-title{
      font-family:'Syne',sans-serif;
      font-size:24px; font-weight:900; color:var(--t1);
      letter-spacing:-.02em; margin-bottom:10px; line-height:1.2;
    }
    .onb2-desc{ font-size:14px; color:var(--t2); line-height:1.7; margin-bottom:24px; }
    .onb2-dots{ display:flex; gap:6px; justify-content:center; margin-bottom:24px; }
    .onb2-dot{ width:6px; height:6px; border-radius:100px; background:var(--bg-4); transition:all .3s ease; }
    .onb2-dot.cur{ width:22px; background:var(--accent-l); }

    .ses-end-kpis{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin:14px 0; }
    .ses-kpi{
      background:var(--bg-2); border:1px solid var(--brd);
      border-radius:var(--r-l); padding:12px 8px; text-align:center;
    }
    .ses-kpi-v{ font-family:'JetBrains Mono',monospace; font-size:22px; font-weight:700; line-height:1; }
    .ses-kpi-l{ font-size:9px; color:var(--t3); margin-top:4px; text-transform:uppercase;
                letter-spacing:.06em; font-family:'JetBrains Mono',monospace; }
    .perfect-badge{
      display:inline-flex; align-items:center; gap:6px;
      background:var(--gold-glow); border:1px solid rgba(212,175,55,.3);
      border-radius:100px; padding:5px 16px;
      font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; color:var(--gold);
      margin-bottom:10px; animation:onbPop .4s var(--tr-spring);
    }

    .err-insight{
      background:var(--bg-1); border:1px solid rgba(239,68,68,.2);
      border-radius:var(--r-l); padding:12px 14px; margin-bottom:8px;
    }
    .err-insight-hd{ display:flex; align-items:center; gap:8px; margin-bottom:6px; }
    .err-insight-name{ font-size:12px; font-weight:700; color:var(--t1); flex:1; }
    .err-insight-rate{ font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--err); font-weight:700; }
    .err-bar{ height:3px; background:var(--bg-3); border-radius:100px; overflow:hidden; margin-bottom:8px; }
    .err-bar-fill{ height:100%; border-radius:100px; background:var(--err); transition:width .6s ease; }
  `;
  const styleEl = document.createElement('style');
  styleEl.id = 'opj-patch-css';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* MISSIONS */
  const ALL_MISSIONS = [
    {id:'m_qcm10',  ico:'⚡', name:'Répondre à 10 questions',       type:'qcm',     target:10, xp:30},
    {id:'m_qcm20',  ico:'🔥', name:'Répondre à 20 questions',       type:'qcm',     target:20, xp:60},
    {id:'m_perfect',ico:'🎯', name:'Session parfaite (sans erreur)',type:'perfect', target:1,  xp:50},
    {id:'m_lesson2',ico:'📖', name:'Lire 2 leçons',                 type:'lesson',  target:2,  xp:20},
    {id:'m_lesson1',ico:'📚', name:'Lire 1 leçon',                  type:'lesson',  target:1,  xp:10},
    {id:'m_due5',   ico:'🔁', name:'Réviser 5 cartes dues',         type:'due',     target:5,  xp:25},
    {id:'m_blitz',  ico:'⚡', name:'Faire 1 Blitz Vrai/Faux',       type:'blitz',   target:1,  xp:20},
    {id:'m_streak', ico:'💪', name:'Maintenir le streak',            type:'streak',  target:1,  xp:15},
  ];

  function ensureMissions(){
    if(!window.S)return;
    const today=new Date().toDateString();
    if(!S.missions2||S.missions2.date!==today){
      const seed=today.split('').reduce((a,c)=>a*31+c.charCodeAt(0)|0,0);
      const shuffled=[...ALL_MISSIONS].sort((a,b)=>{
        const h=(s,n)=>{let v=s;for(let i=0;i<n.length;i++)v=(v*31+n.charCodeAt(i))>>>0;return v;};
        return h(seed,a.id)-h(seed,b.id);
      });
      S.missions2={date:today,active:shuffled.slice(0,3),prog:{}};
      if(typeof save==='function')save();
    }
  }

  function missionProgress(m){
    ensureMissions();
    const v=S.missions2?.prog?.[m.id]||0;
    return{v,done:v>=m.target};
  }

  function incrementMission(type,amount=1){
    if(!window.S)return;
    ensureMissions();
    S.missions2.active.forEach(m=>{
      if(m.type!==type)return;
      const prev=S.missions2.prog[m.id]||0;
      if(prev>=m.target)return;
      S.missions2.prog[m.id]=Math.min(prev+amount,m.target);
      if(S.missions2.prog[m.id]>=m.target&&prev<m.target){
        S._missionFlashId=m.id;
        if(typeof addXP==='function')addXP(m.xp);
        if(typeof showToast==='function')showToast(`🎯 Mission : ${m.name} · +${m.xp} XP`,'ok');
        if(typeof confetti==='function')confetti(false);
      }
    });
    if(typeof save==='function')save();
    renderMissionsCard();
  }
  window.MISSIONS={increment:incrementMission};

  const MISSION_COLS=['#2563eb','#7c3aed','#d97706','#059669','#db2777','#0891b2','#ea580c','#4f46e5'];

  function renderMissionsCard(){
    const el=document.getElementById('patch-missions');
    if(!el||!window.S)return;
    ensureMissions();
    const missions=S.missions2.active;
    const flashId=S._missionFlashId;
    S._missionFlashId=null;
    const done=missions.filter(m=>missionProgress(m).done).length;
    const daysLeft=(S.user?.examDate&&typeof daysUntilExam==='function')?daysUntilExam(S.user.examDate):null;
    let phaseBanner='';
    if(daysLeft!==null){
      const phInf=(typeof examPhaseLabel==='function')?examPhaseLabel(daysLeft):{icon:'🎯',lbl:'BASES',txt:'Construis tes fondamentaux'};
      const phaseIcon=phInf.icon,phaseLbl=phInf.lbl,phaseTxt=phInf.txt;
      phaseBanner=`<div class="phase-banner">
        <div class="phase-icon">${phaseIcon}</div>
        <div class="phase-inf"><div class="phase-lbl">${phaseLbl}</div><div class="phase-txt">${phaseTxt}</div></div>
        <div class="phase-days"><div class="phase-days-n">${daysLeft}</div><div class="phase-days-l">jours</div></div>
      </div>`;
    }
    el.innerHTML=`
      ${phaseBanner}
      <div class="missions-hd">
        <div class="missions-title">⚡ Missions du jour</div>
        <div class="missions-score">${done}/${missions.length} accomplie${done!==1?'s':''}</div>
      </div>
      ${missions.map((m,idx)=>{
        const{v,done:isDone}=missionProgress(m);
        const pct=Math.round(v/m.target*100);
        const col=MISSION_COLS[idx%MISSION_COLS.length];
        const flash=flashId===m.id;
        return`<div class="mission-row ${isDone?'done':''}${flash?' mission-row--flash':''}">
          <div class="mission-ico-wrap" style="background:${col}22;border:1px solid ${col}44">${m.ico}</div>
          <div class="mission-inf">
            <div class="mission-name"><span class="mission-check">✓</span>${m.name}</div>
            <div class="mission-sub">${v}/${m.target}</div>
            <div class="mission-bar"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="mission-xp">+${m.xp}XP</div>
        </div>`;
      }).join('')}`;
  }

  /* COMBO */
  let combo=0, comboTimer=null;
  function showComboHUD(){
    let el=document.getElementById('patch-combo');
    if(combo<2){if(el)el.remove();return;}
    if(!el){el=document.createElement('div');el.id='patch-combo';el.className='combo-hud';document.body.appendChild(el);}
    const fl=['','','🔥','🔥🔥','⚡🔥⚡','💥🔥💥'];
    el.innerHTML=`${fl[Math.min(combo,5)]} COMBO ×${Math.min(combo,4)}`;
    clearTimeout(comboTimer);
    comboTimer=setTimeout(()=>{const e=document.getElementById('patch-combo');if(e)e.remove();},3000);
  }

  /* PATCH answerQ */
  const _answerQ=window.answerQ;
  window.answerQ=function(i){
    const q=window.S?.qcm?.queue?.[window.S?.qcm?.idx];
    if(!q||window.S?.qcm?.answered!==null){if(_answerQ)_answerQ(i);return;}
    const correct=(i===q.c);
    if(correct){
      combo++;
      const mult=Math.min(combo,4);
      if(combo>=3&&typeof showToast==='function'){
        const fl=['','','','🔥','🔥🔥','⚡🔥⚡','💥🔥💥'];
        showToast(`${fl[Math.min(combo,6)]} COMBO ×${mult} !`,'ok');
      }
      showComboHUD();
      incrementMission('qcm',1);
    }else{combo=0;showComboHUD();}
    if(_answerQ)_answerQ(i);
  };

  /* PATCH finishSession */
  const _finishSession=window.finishSession;
  window.finishSession=function(){
    combo=0;showComboHUD();
    if(_finishSession)_finishSession();
    setTimeout(()=>{
      const el=document.getElementById('qcm-results');
      if(!el||el.style.display==='none')return;
      const s=window.S?.qcm?.stats||{ok:0,ko:0,xp:0};
      const tot=(s.ok||0)+(s.ko||0);
      if(!tot)return;
      const perfect=s.ko===0;
      if(perfect)incrementMission('perfect',1);
      const wrap=el.querySelector('.send-wrap');
      if(wrap&&!wrap.querySelector('.ses-end-kpis')){
        const kpis=`${perfect?'<div class="perfect-badge">🏆 Session parfaite !</div>':''}
          <div class="ses-end-kpis">
            <div class="ses-kpi"><div class="ses-kpi-v" style="color:var(--ok)">${s.ok}</div><div class="ses-kpi-l">Correctes</div></div>
            <div class="ses-kpi"><div class="ses-kpi-v" style="color:var(--err)">${s.ko}</div><div class="ses-kpi-l">Erreurs</div></div>
            <div class="ses-kpi"><div class="ses-kpi-v" style="color:var(--gold)">+${s.xp||0}</div><div class="ses-kpi-l">XP</div></div>
          </div>`;
        const ref=wrap.querySelector('.send-title');
        if(ref)ref.insertAdjacentHTML('afterend',kpis);
      }
    },80);
  };

  /* PATCH markLessonDone */
  const _markLessonDone=window.markLessonDone;
  window.markLessonDone=function(id){
    const wasNew=!window.S?.lessons?.[id];
    if(_markLessonDone)_markLessonDone(id);
    if(wasNew)incrementMission('lesson',1);
  };

  /* PLAN D'ÉTUDE */
  const THEME_DEF=[
    {cat:'GAV',         name:'Garde à Vue',        em:'🔒'},
    {cat:'FLAGRANCE',   name:'Flagrance',           em:'🚨'},
    {cat:'PERQUIZ',     name:'Perquisitions',       em:'🔍'},
    {cat:'MANDATS',     name:'Mandats',             em:'📋'},
    {cat:'INFRACTIONS', name:'Infractions',         em:'⚖️'},
    {cat:'LIBERTES',    name:'Libertés publiques',  em:'🛡️'},
    {cat:'COMMISSION',  name:'Commission Rogatoire',em:'📜'},
    {cat:'MESURES_COERC',name:'Mesures Coercitives', em:'⛓️'},
  ];

  function renderStudyPlan(){
    const el=document.getElementById('patch-studyplan');
    if(!el||!window.S||!window.QB)return;
    const daysLeft=(S.user?.examDate&&typeof daysUntilExam==='function')?daysUntilExam(S.user.examDate):null;
    const ps=S.placementDone&&S.placementScore?S.placementScore:{};
    const themes=THEME_DEF.map(t=>{
      const m=computeMastery(t.cat);if(!m.total)return null;
      const placementPenalty=ps[t.cat]!==undefined?(100-ps[t.cat]):0;
      return{...t,...m,placementPenalty};
    }).filter(Boolean).sort((a,b)=>{
      const scoreA=a.mastery-a.placementPenalty*0.3;
      const scoreB=b.mastery-b.placementPenalty*0.3;
      return scoreA-scoreB;
    });
    let phaseIcon='🎯',phaseLbl='BASES',phaseTxt='Construis tes fondamentaux';
    if(daysLeft!==null&&typeof examPhaseLabel==='function'){
      const phInf=examPhaseLabel(daysLeft);
      phaseIcon=phInf.icon;phaseLbl=phInf.lbl;phaseTxt=phInf.txt;
    }
    el.innerHTML=`
      <div class="sp-header">📊 Plan d'étude personnalisé</div>
      ${daysLeft!==null?`<div class="phase-banner">
        <div class="phase-icon">${phaseIcon}</div>
        <div class="phase-inf"><div class="phase-lbl">${phaseLbl}</div><div class="phase-txt">${phaseTxt}</div></div>
        <div class="phase-days"><div class="phase-days-n">${daysLeft}</div><div class="phase-days-l">jours</div></div>
      </div>`:''}
      <div class="sect-label" style="margin-top:4px;margin-bottom:8px">À travailler en priorité</div>
      ${themes.slice(0,3).map(t=>{
        const col=t.mastery>70?'var(--ok)':t.mastery>40?'var(--warn)':'var(--err)';
        return`<div class="sp-row" onclick="navigateTo('revision');setTimeout(()=>startSession&&startSession('${t.cat}'),200)">
          <div class="sp-row-ico">${t.em}</div>
          <div class="sp-row-inf">
            <div class="sp-row-name">${t.name}</div>
            <div class="sp-row-sub">${t.mastery}% maîtrise · ${t.due} due${t.due>1?'s':''} · ${t.total} Q</div>
          </div>
          <div class="sp-row-pct" style="color:${col}">${t.mastery}%</div>
        </div>`;
      }).join('')}`;
  }

  /* ANALYSE ERREURS */
  function renderErrorAnalysis(){
    const el=document.getElementById('patch-errors');
    if(!el||!window.S||!window.QB)return;
    const stats={};
    QB.forEach(q=>{
      const c=S.qcm?.cards?.[q.id];if(!c||c.ko===0)return;
      if(!stats[q.cat])stats[q.cat]={total:0,ko:0};
      stats[q.cat].total++;stats[q.cat].ko+=c.ko;
    });
    const sorted=Object.entries(stats)
      .map(([cat,d])=>({cat,rate:Math.round(d.ko/d.total*10)/10,t:THEME_DEF.find(t=>t.cat===cat)}))
      .filter(e=>e.t).sort((a,b)=>b.rate-a.rate).slice(0,3);
    if(!sorted.length){
      el.innerHTML=`<div class="text-sm text-secondary" style="text-align:center;padding:12px 0">🎉 Pas encore de données. Fais des QCM !</div>`;return;
    }
    el.innerHTML=`<div class="sect-label" style="margin-bottom:8px">⚠️ Points faibles identifiés</div>
      ${sorted.map(e=>`<div class="err-insight">
        <div class="err-insight-hd">
          <span style="font-size:16px">${e.t.em}</span>
          <div class="err-insight-name">${e.t.name}</div>
          <div class="err-insight-rate">${e.rate} err/Q</div>
        </div>
        <div class="err-bar"><div class="err-bar-fill" style="width:${Math.min(100,Math.round(e.rate*15))}%"></div></div>
        <button class="btn btn-danger btn-sm btn-full" onclick="navigateTo('revision');setTimeout(()=>startSession&&startSession('${e.cat}'),200)">Travailler ce thème →</button>
      </div>`).join('')}`;
  }

  /* ONBOARDING */
  const ONB_STEPS=[
    {icon:'👮',title:'Bienvenue dans OPJ Elite',desc:'La préparation la plus complète et gamifiée pour réussir l\'examen d\'Officier de Police Judiciaire.'},
    {icon:'📅',title:'Définis ta date d\'examen',desc:'L\'app adapte ton plan d\'étude et le compte à rebours au jour J.',
     input:`<div class="inp-g mb4"><label class="inp-lbl">Date de l'examen</label><input type="date" class="inp" id="onb2-date" min="${new Date().toISOString().slice(0,10)}" value="2026-06-15" style="font-size:15px"></div>`},
    {icon:'🎯',title:'15 chapitres complets',desc:'GAV, Flagrance, Perquisitions, Commission Rogatoire, Infractions, Libertés publiques… tout le programme officiel OPJ.'},
    {icon:'🏆',title:'Monte en grade !',desc:'De Gardien de la Paix jusqu\'à l\'OPJ en juridiction spécialisée — gagne des XP et débloque des badges.'},
  ];
  let onb2Idx=0;

  function tryShowOnboarding(){
    if(!window.S)return;
    if(S.onb2Done)return;
    if((S.user?.xp||0)>0||Object.keys(S.lessons||{}).length>0)return;
    setTimeout(()=>{
      if(document.getElementById('onb2-ov'))return;
      const ov=document.createElement('div');
      ov.id='onb2-ov';ov.className='onb2-ov';
      document.body.appendChild(ov);renderOnb2();
    },900);
  }

  function renderOnb2(){
    const ov=document.getElementById('onb2-ov');if(!ov)return;
    const step=ONB_STEPS[onb2Idx];
    const isLast=onb2Idx===ONB_STEPS.length-1;
    ov.innerHTML=`<div class="onb2-wrap">
      <span class="onb2-icon">${step.icon}</span>
      <div class="onb2-title">${step.title}</div>
      <div class="onb2-desc">${step.desc}</div>
      ${step.input||''}
      <div class="onb2-dots">${ONB_STEPS.map((_,i)=>`<div class="onb2-dot ${i===onb2Idx?'cur':''}"></div>`).join('')}</div>
      <button class="btn btn-p btn-full mb8" onclick="window._onb2Next()">${isLast?'🚀 Commencer !':'Suivant →'}</button>
      ${onb2Idx>0?`<button class="btn btn-ghost btn-full mb8" onclick="window._onb2Prev()">← Retour</button>`:''}
      <button class="btn btn-ghost btn-full" style="color:var(--t3);font-size:12px" onclick="window._onb2Skip()">Passer l'introduction</button>
    </div>`;
  }
  window._onb2Next=function(){
    if(onb2Idx===1){const d=document.getElementById('onb2-date');if(d?.value&&window.S){S.user.examDate=d.value;if(typeof save==='function')save();}}
    onb2Idx++;
    if(onb2Idx>=ONB_STEPS.length){window._onb2Skip();return;}
    renderOnb2();
  };
  window._onb2Prev=function(){onb2Idx=Math.max(0,onb2Idx-1);renderOnb2();};
  window._onb2Skip=function(){
    if(window.S){S.onb2Done=true;if(typeof save==='function')save();}
    const ov=document.getElementById('onb2-ov');
    if(ov){ov.style.animation='pgIn .3s ease reverse';setTimeout(()=>ov.remove(),280);}
    setTimeout(()=>{if(typeof showToast==='function')showToast('💡 Commence par "Le Procès Pénal" en Leçons !','ok');},600);
  };

  // Global ESC support for overlays/modals
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    try{ if(document.getElementById('lesson-ov')?.classList.contains('on')) closeLesson(); }catch(_){}
    try{ if(document.getElementById('fiche-ov')?.style.display==='flex') closeFiche(); }catch(_){}
    try{ if(document.getElementById('ann-ov')?.style.display==='flex') closeAnnale(); }catch(_){}
    try{ if(document.getElementById('pf-ov')?.style.display==='flex') PFM.close(); }catch(_){}
    try{ if(document.getElementById('eval-ov')?.classList.contains('a')) EVAL.close(); }catch(_){}
    try{ if(document.getElementById('pro-modal-ov')?.classList.contains('a')) P.hidePro(); }catch(_){}
    try{ if(document.getElementById('pay-modal-ov')?.classList.contains('a')) P.hidePay(); }catch(_){}
  });

  /* Legacy FSRS/HTML patch removed */

  /* PATCH navigateTo */
  const _navigateTo=window.navigateTo;
  window.navigateTo=function(page){
    if(_navigateTo)_navigateTo(page);
    setTimeout(()=>{
      if(page==='home'){renderMissionsCard();renderStudyPlan();}
      if(page==='profil'){renderErrorAnalysis();}
    },60);
  };

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){renderMissionsCard();renderStudyPlan();}
  });

  if(window.S){ensureMissions();renderMissionsCard();renderStudyPlan();renderErrorAnalysis();tryShowOnboarding();}
})();
function showXPPop(amount){
  const el=document.createElement('div');
  el.className='xp-pop';
  el.textContent='+'+amount+' XP';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1300);
}
window.showXPPop=showXPPop;
if(typeof window!=='undefined'){window.BLITZ=BLITZ;window.BLITZ_ASSERTIONS=BLITZ_ASSERTIONS;}

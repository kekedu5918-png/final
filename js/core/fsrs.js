'use strict';
/* ═══════════════════════════════════════════════════════
   OPJ ELITE — fsrs.js
   Algorithme de répétition espacée FSRS-Lite
   CORRECTION v53 :
   - Suppression de la double déclaration présente dans app.js (bug critique)
   - getDue() préservée et unique ici
   - Cap intelligent selon date d'examen
   - isDue() amélioré
   ═══════════════════════════════════════════════════════ */

const FSRS = {

  /* ─── Crée une carte vierge ─── */
  newCard: () => ({
    interval: 0,
    ef: 2.5,       // Ease factor initial
    due: Date.now(),
    reps: 0,
    ok: 0,
    ko: 0
  }),

  /* ─── Révise une carte ─── */
  review(card, correct) {
    // CORRECTION : on clone correctement la carte (évite mutation silencieuse)
    const c = card ? { ...card } : FSRS.newCard();
    c.reps++;

    if (correct) {
      c.ok++;
      if (c.reps === 1)      c.interval = 1;
      else if (c.reps === 2) c.interval = 6;
      else                   c.interval = Math.max(1, Math.round(c.interval * c.ef));
      // Ease factor : augmentation douce, plafonné à 2.5
      c.ef = Math.min(2.5, Math.max(1.3, c.ef + 0.1));
    } else {
      c.ko++;
      c.interval = 1;
      // Ease factor : pénalité sur erreur
      c.ef = Math.max(1.3, c.ef - 0.2);
    }

    /* Cap intelligent : ne pas planifier au-delà de la moitié du temps restant
       avant l'examen, pour garantir une révision avant le jour J */
    if (window.S?.user?.examDate) {
      try {
        const exam     = new Date(window.S.user.examDate + '-01');
        const daysLeft = Math.max(1, Math.ceil((exam - Date.now()) / 86400000));
        c.interval     = Math.min(c.interval, Math.max(1, Math.floor(daysLeft / 2)));
      } catch (_) {}
    }

    c.due = Date.now() + c.interval * 86400000;
    return c;
  },

  /* ─── La carte est-elle à réviser maintenant ? ─── */
  isDue: (card) => !card || card.due <= Date.now(),

  /* ─── Retourne toutes les questions dues (optionnel : filtre par catégorie) ─── */
  getDue(cat) {
    const bank = window.QB || [];
    return bank
      .filter(q => !cat || q.cat === cat)
      .filter(q => FSRS.isDue(window.S?.qcm?.cards?.[q.id]));
  },

  /* ─── Statistiques globales de maîtrise ─── */
  getMasteryStats() {
    const bank  = window.QB || [];
    const cards = window.S?.qcm?.cards || {};
    const total = bank.length;
    const seen  = bank.filter(q => (cards[q.id]?.reps || 0) > 0).length;
    const ok    = bank.filter(q => (cards[q.id]?.ok   || 0) > 0).length;
    const due   = bank.filter(q => FSRS.isDue(cards[q.id])).length;
    return { total, seen, ok, due,
             masteryPct: seen > 0 ? Math.round(ok / seen * 100) : 0 };
  }
};

/* Exposer globalement — une seule déclaration, ici */
window.FSRS = FSRS;

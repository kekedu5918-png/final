# Schéma `public.progress` et RLS (Supabase)

Document généré à partir du projet Supabase **OPJ** (réf. `vwkymggfxgkfbbklkhhd`, URL `https://vwkymggfxgkfbbklkhhd.supabase.co`), via les outils MCP Supabase (`execute_sql`, `apply_migration`, `list_projects`).

## Table `public.progress`

### Colonnes

| Colonne | Type | Nullable | Défaut | Commentaire (DB) |
|--------|------|----------|--------|------------------|
| `id` | `uuid` | NON | `gen_random_uuid()` | — |
| `user_id` | `uuid` | OUI | — | — |
| `xp` | `integer` | OUI | `0` | — |
| `streak` | `integer` | OUI | `0` | — |
| `streak_record` | `integer` | OUI | `0` | — |
| `last_activity` | `date` | OUI | — | — |
| `sessions_done` | `integer` | OUI | `0` | — |
| `qcm_cards` | `jsonb` | OUI | `'{}'::jsonb` | — |
| `lessons` | `jsonb` | OUI | `'{}'::jsonb` | — |
| `fiches` | `jsonb` | OUI | `'{}'::jsonb` | — |
| `badges` | `jsonb` | OUI | `'{}'::jsonb` | — |
| `activity` | `jsonb` | OUI | `'{}'::jsonb` | — |
| `shield` | `jsonb` | OUI | `{"count": 1, "lastEarned": null}` | — |
| `annales_done` | `jsonb` | OUI | `'{}'::jsonb` | — |
| `blitz_best` | `integer` | OUI | `0` | — |
| `cr_done` | `integer` | OUI | `0` | — |
| `tc_done` | `integer` | OUI | `0` | — |
| `perfect_sessions` | `integer` | OUI | `0` | — |
| `updated_at` | `timestamptz` | OUI | `now()` | — |
| `flash_fsrs` | `jsonb` | OUI | `'{}'::jsonb` | FSRS flashcards (S.flashFsrs) |
| `oral_scores` | `jsonb` | OUI | `'{}'::jsonb` | Progression entraînement oral (S.oral) |
| `fs_due_session` | `jsonb` | OUI | — | Session fiches dues `{ ids: [...] }` ou null |

### Contraintes

| Nom | Type | Détail |
|-----|------|--------|
| `progress_pkey` | PRIMARY KEY | `(id)` |
| `progress_user_id_key` | UNIQUE | `(user_id)` |
| `progress_user_id_fkey` | FOREIGN KEY | `user_id` → `auth.users(id)` **ON DELETE CASCADE** |

### Row Level Security (RLS)

- **RLS activé** sur `public.progress` (`relrowsecurity = true`).
- **FORCE ROW LEVEL SECURITY** : non (`relforcerowsecurity = false`).

### Politiques RLS (rôle `public`, permissives)

| Politique | Commande | USING | WITH CHECK |
|-----------|----------|-------|------------|
| Users can view own progress | `SELECT` | `auth.uid() = user_id` | — |
| Users can insert own progress | `INSERT` | — | `auth.uid() = user_id` |
| Users can update own progress | `UPDATE` | `auth.uid() = user_id` | `auth.uid() = user_id` |

**Note :** Les politiques **SELECT**, **INSERT** et **UPDATE** restreignent l’accès à `user_id = auth.uid()`. La politique **UPDATE** inclut un **WITH CHECK** pour empêcher de réassigner une ligne à un autre utilisateur après mise à jour.

### Équivalent SQL des politiques (référence)

```sql
-- Déjà en place sur le projet (ne pas ré-exécuter tel quel si les noms existent)
alter table public.progress enable row level security;

create policy "Users can view own progress"
  on public.progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on public.progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

*Dernière mise à jour des données : introspection MCP Supabase sur la table `progress` (colonnes, contraintes, `pg_policies`, RLS).*

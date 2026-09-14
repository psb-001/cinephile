import { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../AppContext.js';

interface FormState {
  token: string;
  repo: string;
  branch: string;
  name: string;
  email: string;
  apiKey: string;
}

const TOKEN_HELP = 'https://github.com/settings/tokens/new?scopes=repo&description=cinephile';
const TMDB_HELP = 'https://www.themoviedb.org/settings/api';

export function SettingsPage() {
  const { config, configLoading, pushToast } = useApp();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState(false);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Pre-fill from existing config until the user edits.
  const value: FormState =
    form ?? {
      token: '',
      repo: config?.github?.repo ?? '',
      branch: config?.github?.branch ?? '',
      name: config?.commitAuthor?.name ?? '',
      email: config?.commitAuthor?.email ?? '',
      apiKey: '',
    };

  const set = (patch: Partial<FormState>) => {
    setForm({ ...value, ...patch });
    setSuccessInfo(null);
  };

  const save = async () => {
    setValidating(true);
    setErrors({});
    setSuccessInfo(null);
    try {
      const result = await api.saveConfig({
        github: { token: value.token, repo: value.repo, branch: value.branch || undefined },
        commitAuthor: { name: value.name, email: value.email },
        tmdb: { apiKey: value.apiKey },
      });
      if (result.ok && result.saved) {
        setSuccessInfo(
          `Saved ✓ Connected as ${result.github?.login ?? '?'} → ${result.github?.repoFullName ?? value.repo}` +
            ` (branch: ${result.github?.defaultBranch ?? 'main'})`,
        );
        setForm(null); // re-read masked config next render
        pushToast({ kind: 'success', message: 'Settings saved and validated.' });
      } else {
        setErrors(result.errors ?? { _: 'Validation failed.' });
      }
    } catch (err) {
      setErrors({ _: err instanceof Error ? err.message : String(err) });
    } finally {
      setValidating(false);
    }
  };

  if (config?.demo) {
    return (
      <div className="page settings-page">
        <div className="page-head">
          <h1>Settings</h1>
        </div>
        <div className="alert alert-info">
          <strong>Demo mode — fixture data, not your collection.</strong> The app is running with{' '}
          <code>CINEPHILE_DEMO=1</code>: search results, the library, and the cupboard all come from
          bundled demo data, and marking watched makes <strong>no real commits</strong>. Restart
          without the flag and configure your GitHub repo + TMDB key below to track your real
          watches.
        </div>
      </div>
    );
  }

  return (
    <div className="page settings-page">
      <div className="page-head">
        <h1>Settings</h1>
        <p className="page-sub">
          Credentials are stored only in your local <code>config.json</code> (gitignored) and never
          leave this machine except to call GitHub and TMDB APIs.
        </p>
      </div>

      {configLoading ? <div className="loading">Loading…</div> : null}

      {config?.configured && !form ? (
        <div className="alert alert-success">
          Currently configured for <strong>{config.github?.repo}</strong> (branch{' '}
          <strong>{config.github?.branch}</strong>), committing as{' '}
          <strong>{config.commitAuthor?.name}</strong> &lt;{config.commitAuthor?.email}&gt;. Enter a
          new token or TMDB key below to change anything.
        </div>
      ) : null}

      {successInfo ? <div className="alert alert-success">{successInfo}</div> : null}
      {errors._ ? <div className="alert alert-error">{errors._}</div> : null}

      <div className="settings-form">
        <section className="settings-section">
          <h2>GitHub</h2>
          <label className="field">
            <span>Personal access token (repo scope)</span>
            <input
              type="password"
              placeholder={config?.configured ? 'ghp_•••• (leave blank to keep current)' : 'ghp_…'}
              value={value.token}
              onChange={(e) => set({ token: e.target.value })}
              autoComplete="off"
            />
            {errors['github.token'] ? (
              <em className="field-error">{errors['github.token']}</em>
            ) : (
              <em className="field-help">
                Create one at{' '}
                <a href={TOKEN_HELP} target="_blank" rel="noreferrer">
                  github.com/settings/tokens
                </a>{' '}
                — the classic <code>repo</code> scope is enough.
              </em>
            )}
          </label>
          <label className="field">
            <span>Target repo (owner/name)</span>
            <input
              type="text"
              placeholder="yourname/watched"
              value={value.repo}
              onChange={(e) => set({ repo: e.target.value })}
            />
            {errors['github.repo'] ? <em className="field-error">{errors['github.repo']}</em> : (
              <em className="field-help">Any repo you can push to. A dedicated private repo works great.</em>
            )}
          </label>
          <label className="field">
            <span>Branch (optional — defaults to the repo’s default branch)</span>
            <input
              type="text"
              placeholder="main"
              value={value.branch}
              onChange={(e) => set({ branch: e.target.value })}
            />
          </label>
        </section>

        <section className="settings-section">
          <h2>Commit author</h2>
          <p className="settings-note">
            Commits are authored with this name and email. For the green squares to count on your
            profile, the <strong>email must be associated with your GitHub account</strong> (
            <a href="https://github.com/settings/emails" target="_blank" rel="noreferrer">settings/emails</a>).
          </p>
          <div className="field-row">
            <label className="field">
              <span>Name</span>
              <input type="text" placeholder="Your Name" value={value.name} onChange={(e) => set({ name: e.target.value })} />
              {errors['commitAuthor.name'] ? <em className="field-error">{errors['commitAuthor.name']}</em> : null}
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" placeholder="you@example.com" value={value.email} onChange={(e) => set({ email: e.target.value })} />
              {errors['commitAuthor.email'] ? <em className="field-error">{errors['commitAuthor.email']}</em> : null}
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>TMDB</h2>
          <label className="field">
            <span>API key</span>
            <input
              type="password"
              placeholder={config?.configured ? '•••• (leave blank to keep current)' : '32-char v3 key or v4 read token'}
              value={value.apiKey}
              onChange={(e) => set({ apiKey: e.target.value })}
              autoComplete="off"
            />
            {errors['tmdb.apiKey'] ? (
              <em className="field-error">{errors['tmdb.apiKey']}</em>
            ) : (
              <em className="field-help">
                Free key at{' '}
                <a href={TMDB_HELP} target="_blank" rel="noreferrer">
                  themoviedb.org/settings/api
                </a>{' '}
                (v3 API key, or a v4 read access token).
              </em>
            )}
          </label>
        </section>

        <div className="settings-actions">
          <button className="btn btn-primary" onClick={save} disabled={validating}>
            {validating ? 'Validating…' : 'Validate & save'}
          </button>
          <span className="settings-hint">Each credential is checked live (GitHub whoami + repo push access, TMDB ping) before saving.</span>
        </div>
      </div>
    </div>
  );
}

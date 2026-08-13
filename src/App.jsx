import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LogIn, LogOut, Plus, Users, FileText, LayoutDashboard, CheckCircle2,
  XCircle, Trash2, Filter, Printer, ShieldCheck, Search, ChevronLeft,
  ImageOff, UserPlus, AlertTriangle, Loader2, Upload
} from "lucide-react";
import { supabase } from "./supabaseClient.js";

/* ------------------------------------------------------------------ */
/* Constantes de domínio                                              */
/* ------------------------------------------------------------------ */

const CATEGORIAS = ["Acessórios", "Equipamentos de Manutenção", "Eventos", "Patrimônio", "Outros"];
const MOTIVOS = ["Desgaste Natural", "Quebra/Avaria", "Perda", "Outro"];
const DESTINOS = ["Lixo Geral", "Reciclagem", "Doação", "Outro"];

const STATUS = {
  pendente: { label: "Pendente", color: "var(--amber)" },
  aprovado: { label: "Aprovado", color: "var(--forest)" },
  rejeitado: { label: "Rejeitado", color: "var(--rust)" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ------------------------------------------------------------------ */
/* Componentes utilitários                                            */
/* ------------------------------------------------------------------ */

function StatusStamp({ status }) {
  const s = STATUS[status] || STATUS.pendente;
  return <span className="stamp" style={{ color: s.color, borderColor: s.color }}>{s.label}</span>;
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.type}`}>{toast.text}</div>;
}

function Thumb({ url, alt }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div className="thumb thumb-empty">
        <ImageOff size={16} />
        <span>sem foto</span>
      </div>
    );
  }
  return <img className="thumb" src={url} alt={alt} onError={() => setErr(true)} />;
}

/* ------------------------------------------------------------------ */
/* Tela de login                                                      */
/* ------------------------------------------------------------------ */

function LoginView({ onLoginError }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setLoading(false);
    if (err) {
      setError("E-mail ou senha inválidos.");
      onLoginError?.(err);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-mark">
          <div className="brand-ring">DKP</div>
          <div>
            <h1 className="brand-title">Deutscher Klub Pernambuco</h1>
            <p className="brand-sub">Inventário&nbsp;/&nbsp;Descartes</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <Field label="E-mail">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu.nome@dkp.org.br" autoComplete="username" />
          </Field>
          <Field label="Senha">
            <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </Field>
          {error && <p className="form-error"><AlertTriangle size={14} /> {error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />} Entrar
          </button>
        </form>

        <p className="login-hint">
          Não tem conta? Peça a um administrador do clube para te cadastrar em <strong>Usuários</strong>.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulário: novo descarte                                          */
/* ------------------------------------------------------------------ */

function NovoDescarteView({ currentUser, onCreate, notify, goTo }) {
  const isApprover = currentUser.papel === "admin";
  const [item, setItem] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [destino, setDestino] = useState(DESTINOS[0]);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [observacao, setObservacao] = useState("");
  const [aprovarJa, setAprovarJa] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFotoFile(f);
    setFotoPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!item.trim() || saving) return;
    setSaving(true);
    try {
      let fotoUrl = null;
      if (fotoFile) {
        const path = `${currentUser.id}/${Date.now()}-${fotoFile.name}`;
        const { error: upErr } = await supabase.storage.from("fotos-descartes").upload(path, fotoFile);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("fotos-descartes").getPublicUrl(path);
        fotoUrl = pub.publicUrl;
      }
      const now = new Date().toISOString();
      const record = {
        item: item.trim(),
        categoria,
        motivo,
        destino,
        foto_url: fotoUrl,
        observacao: observacao.trim(),
        solicitante_id: currentUser.id,
        solicitante_nome: currentUser.nome,
        aprovador_id: aprovarJa ? currentUser.id : null,
        aprovador_nome: aprovarJa ? currentUser.nome : null,
        status: aprovarJa ? "aprovado" : "pendente",
        data_decisao: aprovarJa ? now : null,
      };
      await onCreate(record);
      notify("success", "Descarte registrado com sucesso.");
      setItem(""); setObservacao(""); setFotoFile(null); setFotoPreview(null); setAprovarJa(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      goTo("painel");
    } catch (err) {
      notify("error", "Não foi possível registrar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="view-pad">
      <h2 className="view-title">Novo descarte</h2>
      <form onSubmit={handleSubmit} className="card form-grid">
        <Field label="Item">
          <input value={item} onChange={(e) => setItem(e.target.value)} required placeholder="Ex.: Rede de futsal" />
        </Field>
        <Field label="Categoria">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Motivo">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Destino">
          <select value={destino} onChange={(e) => setDestino(e.target.value)}>
            {DESTINOS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Foto (opcional)">
          <div className="file-input-row">
            <button type="button" className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} /> Escolher foto
            </button>
            {fotoPreview && <img src={fotoPreview} alt="" className="thumb" />}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        </Field>
        <Field label="Observação (opcional)">
          <textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Detalhes adicionais sobre o item ou o estado dele" />
        </Field>

        {isApprover && (
          <label className="checkbox-row">
            <input type="checkbox" checked={aprovarJa} onChange={(e) => setAprovarJa(e.target.checked)} />
            <span>Aprovar imediatamente (você é aprovador)</span>
          </label>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Registrar descarte
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

function PainelView({ currentUser, descartes, onDecide, onSoftDelete, notify }) {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [categoriaFilter, setCategoriaFilter] = useState("todas");
  const [busca, setBusca] = useState("");

  const isAdmin = currentUser.papel === "admin";

  const visiveis = useMemo(() => {
    let list = descartes;
    if (statusFilter !== "todos") list = list.filter((d) => d.status === statusFilter);
    if (categoriaFilter !== "todas") list = list.filter((d) => d.categoria === categoriaFilter);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      list = list.filter((d) => d.item.toLowerCase().includes(q) || d.solicitante_nome.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => new Date(b.data_criacao) - new Date(a.data_criacao));
  }, [descartes, statusFilter, categoriaFilter, busca]);

  const counts = useMemo(() => ({
    total: descartes.length,
    pendente: descartes.filter((d) => d.status === "pendente").length,
    aprovado: descartes.filter((d) => d.status === "aprovado").length,
    rejeitado: descartes.filter((d) => d.status === "rejeitado").length,
  }), [descartes]);

  return (
    <div className="view-pad">
      <h2 className="view-title">Painel</h2>

      <div className="summary-grid">
        <SummaryCard label="Total" value={counts.total} color="var(--ink)" />
        <SummaryCard label="Pendentes" value={counts.pendente} color="var(--amber)" />
        <SummaryCard label="Aprovados" value={counts.aprovado} color="var(--forest)" />
        <SummaryCard label="Rejeitados" value={counts.rejeitado} color="var(--rust)" />
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <Search size={15} />
          <input placeholder="Buscar item ou solicitante" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="aprovado">Aprovados</option>
          <option value="rejeitado">Rejeitados</option>
        </select>
        <select value={categoriaFilter} onChange={(e) => setCategoriaFilter(e.target.value)}>
          <option value="todas">Todas categorias</option>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {visiveis.length === 0 ? (
        <div className="empty-state"><p>Nenhum descarte encontrado com esses filtros.</p></div>
      ) : (
        <ul className="record-list">
          {visiveis.map((d) => (
            <li key={d.id} className={`record-card ${d.excluido ? "record-card-excluido" : ""}`}>
              <Thumb url={d.foto_url} alt={d.item} />
              <div className="record-info">
                <div className="record-title-row">
                  <strong>{d.item}</strong>
                  {d.excluido && <span className="stamp stamp-mini" style={{ color: "var(--rust)", borderColor: "var(--rust)" }}>Excluído</span>}
                </div>
                <span className="record-cat">{d.categoria}</span>
                <div className="record-meta">
                  <span>{d.motivo}</span>
                  <span>→ {d.destino}</span>
                  <span>{d.solicitante_nome}</span>
                  <span>{fmtDate(d.data_criacao)}</span>
                </div>
              </div>
              <div className="record-actions">
                <StatusStamp status={d.status} />
                {isAdmin && d.status === "pendente" && (
                  <div className="action-row">
                    <button className="icon-btn icon-btn-approve" title="Aprovar" onClick={() => { onDecide(d.id, "aprovado"); notify("success", `"${d.item}" aprovado.`); }}>
                      <CheckCircle2 size={17} />
                    </button>
                    <button className="icon-btn icon-btn-reject" title="Rejeitar" onClick={() => { onDecide(d.id, "rejeitado"); notify("info", `"${d.item}" rejeitado.`); }}>
                      <XCircle size={17} />
                    </button>
                  </div>
                )}
                {isAdmin && !d.excluido && (
                  <button className="icon-btn" title="Marcar como excluído" onClick={() => { onSoftDelete(d.id); notify("info", `"${d.item}" marcado como excluído.`); }}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="summary-card" style={{ borderColor: color }}>
      <span className="summary-label">{label}</span>
      <span className="summary-value" style={{ color }}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Usuários (admin)                                                    */
/* ------------------------------------------------------------------ */

function UsuariosView({ users, currentUser, onAdd, onToggleAtivo, onChangeRole, notify }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState("colaborador");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha.trim() || saving) return;
    setSaving(true);
    setFormError("");
    try {
      await onAdd({ nome: nome.trim(), email: email.trim(), senha, papel });
      notify("success", `Usuário "${nome.trim()}" criado.`);
      setNome(""); setEmail(""); setSenha(""); setPapel("colaborador");
    } catch (err) {
      setFormError(err.message || "Não foi possível criar o usuário.");
    } finally {
      setSaving(false);
    }
  }

  const admins = users.filter((u) => u.papel === "admin" && u.ativo);

  return (
    <div className="view-pad">
      <h2 className="view-title">Usuários</h2>

      <ul className="user-list">
        {users.map((u) => {
          const isLastAdmin = u.papel === "admin" && admins.length === 1 && u.id === admins[0]?.id;
          return (
            <li key={u.id} className={`user-row ${!u.ativo ? "user-row-inactive" : ""}`}>
              <div>
                <strong>{u.nome}</strong>
                <div className="user-email">{u.email}</div>
              </div>
              <div className="user-controls">
                <select value={u.papel} disabled={isLastAdmin} onChange={(e) => onChangeRole(u.id, e.target.value)}>
                  <option value="colaborador">Colaborador</option>
                  <option value="admin">Administrador</option>
                </select>
                <button
                  className={`btn btn-sm ${u.ativo ? "btn-ghost" : "btn-ghost-positive"}`}
                  disabled={isLastAdmin && u.ativo}
                  title={isLastAdmin ? "É o único administrador ativo" : ""}
                  onClick={() => onToggleAtivo(u.id, u.ativo)}
                >
                  {u.ativo ? "Desativar" : "Reativar"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="subtitle"><UserPlus size={16} /> Novo usuário</h3>
      <form onSubmit={handleAdd} className="card form-grid">
        <Field label="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} required /></Field>
        <Field label="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Senha provisória"><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></Field>
        <Field label="Papel">
          <select value={papel} onChange={(e) => setPapel(e.target.value)}>
            <option value="colaborador">Colaborador</option>
            <option value="admin">Administrador</option>
          </select>
        </Field>
        {formError && <p className="form-error"><AlertTriangle size={14} /> {formError}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Criar usuário
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Relatório                                                           */
/* ------------------------------------------------------------------ */

function RelatorioView({ currentUser, descartes }) {
  const [categoria, setCategoria] = useState("todas");
  const [statusF, setStatusF] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [gerado, setGerado] = useState(false);
  const [emitidoEm, setEmitidoEm] = useState(null);

  const filtrosAtivos = categoria !== "todas" || statusF !== "todos" || de || ate;

  const filtrados = useMemo(() => {
    let list = descartes;
    if (categoria !== "todas") list = list.filter((d) => d.categoria === categoria);
    if (statusF !== "todos") list = list.filter((d) => d.status === statusF);
    if (de) list = list.filter((d) => d.data_criacao.slice(0, 10) >= de);
    if (ate) list = list.filter((d) => d.data_criacao.slice(0, 10) <= ate);
    return list;
  }, [descartes, categoria, statusF, de, ate]);

  const grupos = useMemo(() => ({
    pendente: filtrados.filter((d) => d.status === "pendente"),
    aprovado: filtrados.filter((d) => d.status === "aprovado"),
    rejeitado: filtrados.filter((d) => d.status === "rejeitado"),
  }), [filtrados]);

  function gerar() {
    setEmitidoEm(new Date().toISOString());
    setGerado(true);
  }

  if (!gerado) {
    return (
      <div className="view-pad">
        <h2 className="view-title">Relatório de descartes</h2>
        <div className="card form-grid">
          <Field label="Categoria">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="todas">Todas</option>
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="pendente">Aguardando aprovação</option>
              <option value="aprovado">Aprovados</option>
              <option value="rejeitado">Rejeitados</option>
            </select>
          </Field>
          <Field label="De"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Field>
          <Field label="Até"><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Field>
          <button className="btn btn-primary btn-block" onClick={gerar}><FileText size={16} /> Emitir relatório</button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-pad">
      <div className="report-toolbar no-print">
        <button className="btn btn-ghost" onClick={() => setGerado(false)}><ChevronLeft size={15} /> Ajustar filtros</button>
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Imprimir / salvar PDF</button>
      </div>

      <div className="report-sheet">
        <div className="report-header">
          <div className="brand-mark brand-mark-sm">
            <div className="brand-ring brand-ring-sm">DKP</div>
            <div>
              <h1 className="brand-title-sm">Inventário/Descartes - DKP</h1>
              <p className="brand-sub-sm">Histórico de descartes</p>
            </div>
          </div>
          <div className="report-meta">
            <strong>Relatório de Descartes</strong>
            <span>Emitido em {fmtDateTime(emitidoEm)}</span>
            <span>Responsável: {currentUser.nome}</span>
            <span>{filtrosAtivos ? "Filtros aplicados" : "Sem filtros aplicados"}</span>
          </div>
        </div>

        <div className="summary-grid report-summary">
          <SummaryCard label="Total" value={filtrados.length} color="var(--ink)" />
          <SummaryCard label="Pendentes" value={grupos.pendente.length} color="var(--amber)" />
          <SummaryCard label="Aprovados" value={grupos.aprovado.length} color="var(--forest)" />
          <SummaryCard label="Rejeitados" value={grupos.rejeitado.length} color="var(--rust)" />
        </div>

        <ReportSection title="Aguardando Aprovação" items={grupos.pendente} />
        <ReportSection title="Aprovados" items={grupos.aprovado} />
        <ReportSection title="Rejeitados" items={grupos.rejeitado} />

        <div className="report-footer">Inventário/Descartes - DKP · Relatório de Descartes · Confidencial — uso interno</div>
      </div>
    </div>
  );
}

function ReportSection({ title, items }) {
  return (
    <section className="report-section">
      <h3 className="report-section-title">{title} <span>{items.length} solicitação(ões)</span></h3>
      {items.length === 0 ? (
        <p className="report-empty">Nenhum registro nesta categoria.</p>
      ) : (
        <table className="report-table">
          <thead>
            <tr><th>Foto</th><th>Item</th><th>Motivo</th><th>Destino</th><th>Solicitante</th><th>Aprovador</th><th>Data</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td><Thumb url={d.foto_url} alt={d.item} /></td>
                <td>
                  <strong>{d.item}</strong>
                  <div className="report-table-cat">{d.categoria}</div>
                  {d.excluido && <span className="stamp stamp-mini" style={{ color: "var(--rust)", borderColor: "var(--rust)" }}>Excluído</span>}
                </td>
                <td>{d.motivo}</td>
                <td>{d.destino}</td>
                <td>{d.solicitante_nome}</td>
                <td>{d.aprovador_nome || "—"}</td>
                <td>{fmtDate(d.data_criacao)}</td>
                <td><StatusStamp status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Shell / navegação                                                   */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "novo", label: "Novo", icon: Plus },
  { key: "relatorio", label: "Relatório", icon: FileText },
  { key: "usuarios", label: "Usuários", icon: Users, adminOnly: true },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [descartes, setDescartes] = useState([]);
  const [view, setView] = useState("painel");
  const [toast, setToast] = useState(null);

  const notify = useCallback((type, text) => {
    setToast({ type, text });
    window.clearTimeout(window.__dkpToastTimer);
    window.__dkpToastTimer = window.setTimeout(() => setToast(null), 3400);
  }, []);

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setCurrentUser(data ? { id: data.id, nome: data.nome, email: data.email, papel: data.papel, ativo: data.ativo } : null);
  }, []);

  const loadDescartes = useCallback(async () => {
    const { data } = await supabase.from("descartes").select("*").order("data_criacao", { ascending: false });
    setDescartes(data || []);
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("nome");
    setUsers(data || []);
  }, []);

  // Sessão + listener de login/logout
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Ao logar/deslogar, carrega perfil e dados
  useEffect(() => {
    (async () => {
      setLoading(true);
      if (session?.user) {
        await loadProfile(session.user.id);
        await loadDescartes();
      } else {
        setCurrentUser(null);
        setDescartes([]);
        setUsers([]);
      }
      setLoading(false);
    })();
  }, [session, loadProfile, loadDescartes]);

  // Carrega lista de usuários só quando admin abre a aba Usuários
  useEffect(() => {
    if (view === "usuarios" && currentUser?.papel === "admin") loadUsers();
  }, [view, currentUser, loadUsers]);

  // Atualização em tempo real dos descartes (outros usuários aprovando/registrando)
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel("descartes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "descartes" }, () => loadDescartes())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentUser, loadDescartes]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setView("painel");
  }

  async function handleCreateDescarte(record) {
    const { error } = await supabase.from("descartes").insert(record);
    if (error) throw error;
    await loadDescartes();
  }

  async function handleDecide(id, status) {
    const { error } = await supabase
      .from("descartes")
      .update({ status, aprovador_id: currentUser.id, aprovador_nome: currentUser.nome, data_decisao: new Date().toISOString() })
      .eq("id", id);
    if (error) notify("error", "Falha ao atualizar: " + error.message);
    else loadDescartes();
  }

  async function handleSoftDelete(id) {
    const { error } = await supabase.from("descartes").update({ excluido: true }).eq("id", id);
    if (error) notify("error", "Falha ao excluir: " + error.message);
    else loadDescartes();
  }

  async function handleAddUser({ nome, email, senha, papel }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { nome, email, senha, papel },
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    });
    if (error) throw new Error(error.message || "Erro ao criar usuário.");
    if (data?.error) throw new Error(data.error);
    await loadUsers();
  }

  async function handleToggleAtivo(id, ativoAtual) {
    const { error } = await supabase.from("profiles").update({ ativo: !ativoAtual }).eq("id", id);
    if (error) notify("error", error.message);
    else loadUsers();
  }

  async function handleChangeRole(id, papel) {
    const { error } = await supabase.from("profiles").update({ papel }).eq("id", id);
    if (error) notify("error", error.message);
    else loadUsers();
  }

  return (
    <div className="dkp-root">
      <GlobalStyles />
      {loading ? (
        <div className="loading-screen"><Loader2 className="spin" size={28} /></div>
      ) : !currentUser ? (
        <LoginView />
      ) : (
        <div className="app-shell">
          <header className="topbar no-print">
            <div className="brand-mark brand-mark-xs">
              <div className="brand-ring brand-ring-xs">DKP</div>
              <span className="topbar-title">Descartes</span>
            </div>
            <div className="topbar-user">
              <span className="topbar-user-name">{currentUser.nome}</span>
              <span className={`role-chip role-${currentUser.papel}`}>
                <ShieldCheck size={12} /> {currentUser.papel === "admin" ? "Admin" : "Colaborador"}
              </span>
              <button className="icon-btn" title="Sair" onClick={handleLogout}><LogOut size={16} /></button>
            </div>
          </header>

          <div className="app-body">
            <nav className="sidenav no-print">
              {NAV_ITEMS.filter((i) => !i.adminOnly || currentUser.papel === "admin").map((i) => (
                <button key={i.key} className={`sidenav-item ${view === i.key ? "sidenav-item-active" : ""}`} onClick={() => setView(i.key)}>
                  <i.icon size={17} /> <span>{i.label}</span>
                </button>
              ))}
            </nav>

            <main className="content">
              {view === "painel" && (
                <PainelView currentUser={currentUser} descartes={descartes} onDecide={handleDecide} onSoftDelete={handleSoftDelete} notify={notify} />
              )}
              {view === "novo" && (
                <NovoDescarteView currentUser={currentUser} onCreate={handleCreateDescarte} notify={notify} goTo={setView} />
              )}
              {view === "relatorio" && <RelatorioView currentUser={currentUser} descartes={descartes} />}
              {view === "usuarios" && currentUser.papel === "admin" && (
                <UsuariosView users={users} currentUser={currentUser} onAdd={handleAddUser} onToggleAtivo={handleToggleAtivo} onChangeRole={handleChangeRole} notify={notify} />
              )}
            </main>
          </div>

          <nav className="bottomnav no-print">
            {NAV_ITEMS.filter((i) => !i.adminOnly || currentUser.papel === "admin").map((i) => (
              <button key={i.key} className={`bottomnav-item ${view === i.key ? "bottomnav-item-active" : ""}`} onClick={() => setView(i.key)}>
                <i.icon size={19} />
                <span>{i.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Estilos                                                             */
/* ------------------------------------------------------------------ */

function GlobalStyles() {
  return (
    <style>{`
      :root{
        --ink:#1B2420; --paper:#F8AE01; --paper-dim:#E7ECE2; --white:#FFFFFF;
        --forest:#32CD32; --red:#A50000; --brass:#A9863C; --rust:#B4483A; --amber:#B4842A;
        --line: rgba(27,36,32,0.14);
        --font-display:'Fraunces', serif; --font-body:'Inter', system-ui, sans-serif; --font-mono:'JetBrains Mono', monospace;
      }
      *{box-sizing:border-box;}
      .dkp-root{ font-family:var(--font-body); color:var(--ink); background:var(--paper); min-height:100vh; -webkit-font-smoothing:antialiased; }
      button, input, select, textarea{ font-family:inherit; }
      button{ cursor:pointer; }
      *:focus-visible{ outline:2px solid var(--brass); outline-offset:2px; }

      .loading-screen{ min-height:100vh; display:flex; align-items:center; justify-content:center; color:var(--red); }
      .spin{ animation:spin 1s linear infinite; }
      @keyframes spin{ to{ transform:rotate(360deg); } }

      .brand-mark{ display:flex; align-items:center; gap:14px; }
      .brand-ring{ width:56px; height:56px; border-radius:50%; border:2px solid var(--brass); background:var(--red); color:var(--paper);
        display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-weight:700; font-size:.85rem; letter-spacing:.04em; flex-shrink:0; }
      .brand-title{ font-family:var(--font-display); font-weight:700; font-size:1.3rem; margin:0; line-height:1.15; }
      .brand-sub{ margin:2px 0 0; font-family:var(--font-mono); font-size:.68rem; letter-spacing:.14em; text-transform:uppercase; color:var(--brass); }
      .brand-mark-sm .brand-ring-sm{ width:40px; height:40px; font-size:.65rem; }
      .brand-title-sm{ font-family:var(--font-display); font-weight:700; font-size:1rem; margin:0; }
      .brand-sub-sm{ margin:1px 0 0; font-family:var(--font-mono); font-size:.62rem; letter-spacing:.1em; text-transform:uppercase; color:var(--brass); }
      .brand-mark-xs{ gap:8px; }
      .brand-ring-xs{ width:30px; height:30px; font-size:.55rem; border-width:1.5px; }
      .topbar-title{ font-family:var(--font-display); font-weight:700; font-size:1.05rem; }

      .login-screen{ min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
        background: radial-gradient(circle at 20% 15%, rgba(47,107,79,0.10), transparent 45%), radial-gradient(circle at 85% 85%, rgba(169,134,60,0.12), transparent 45%), var(--paper); }
      .login-card{ width:100%; max-width:380px; background:var(--white); border:1px solid var(--line); border-radius:14px; padding:32px 28px; box-shadow:0 20px 40px -25px rgba(27,36,32,0.35); }
      .login-card .brand-mark{ margin-bottom:24px; }
      .login-form{ display:flex; flex-direction:column; gap:16px; }
      .login-hint{ margin-top:18px; font-size:.78rem; color:#6B7A6F; text-align:center; }

      .app-shell{ display:flex; flex-direction:column; min-height:100vh; }
      .topbar{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--red); color:var(--paper); position:sticky; top:0; z-index:10; }
      .topbar-user{ display:flex; align-items:center; gap:10px; }
      .topbar-user-name{ font-size:.85rem; font-weight:600; display:none; }
      .role-chip{ display:flex; align-items:center; gap:4px; font-size:.66rem; letter-spacing:.05em; text-transform:uppercase; padding:3px 8px; border-radius:20px; background:rgba(255,255,255,0.12); }
      .topbar .icon-btn{ color:var(--paper); }
      .topbar .icon-btn:hover{ background:rgba(255,255,255,0.14); }

      .app-body{ flex:1; display:flex; }
      .content{ flex:1; padding-bottom:84px; min-width:0; }
      .sidenav{ display:none; }

      .bottomnav{ position:fixed; bottom:0; left:0; right:0; display:flex; background:var(--white); border-top:1px solid var(--line); z-index:10; }
      .bottomnav-item{ flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:9px 4px 10px; border:none; background:none; color:#A9863C; font-size:.66rem; font-weight:600; }
      .bottomnav-item-active{ color:var(--red); }

      .view-pad{ padding:18px 16px 8px; max-width:960px; margin:0 auto; }
      .view-title{ font-family:var(--font-display); font-size:1.5rem; margin:2px 0 16px; }
      .subtitle{ display:flex; align-items:center; gap:6px; font-size:.95rem; margin:26px 0 10px; color:var(--red); }

      .card{ background:var(--white); border:1px solid var(--line); border-radius:12px; padding:18px; }
      .form-grid{ display:flex; flex-direction:column; gap:14px; }
      .field{ display:flex; flex-direction:column; gap:5px; }
      .field-label{ font-size:.78rem; font-weight:600; color:#4A5750; }
      .field-hint{ font-size:.7rem; color:#8B968E; }
      .field input, .field select, .field textarea{ border:1px solid var(--line); border-radius:8px; padding:9px 11px; font-size:.92rem; background:var(--paper); color:var(--ink); }
      .field input:focus, .field select:focus, .field textarea:focus{ background:var(--white); }
      .file-input-row{ display:flex; align-items:center; gap:10px; }
      .checkbox-row{ display:flex; align-items:center; gap:8px; font-size:.85rem; }
      .form-error{ display:flex; align-items:center; gap:6px; color:var(--rust); font-size:.8rem; margin:0; }

      .btn{ display:inline-flex; align-items:center; justify-content:center; gap:7px; border-radius:9px; border:1px solid transparent; padding:10px 16px; font-size:.88rem; font-weight:600; transition:filter .15s; }
      .btn-block{ width:100%; }
      .btn-primary{ background:var(--red); color:var(--white); }
      .btn-primary:hover{ filter:brightness(1.1); }
      .btn-ghost{ background:transparent; border-color:var(--line); color:var(--ink); }
      .btn-ghost:hover{ background:var(--paper-dim); }
      .btn-ghost-positive{ background:transparent; border-color:var(--forest); color:var(--red); }
      .btn-sm{ padding:5px 10px; font-size:.72rem; }
      .btn:disabled{ opacity:.55; cursor:not-allowed; }

      .icon-btn{ border:none; background:transparent; color:var(--ink); border-radius:8px; padding:7px; display:flex; align-items:center; }
      .icon-btn:hover{ background:var(--paper-dim); }
      .icon-btn-approve{ color:var(--red); }
      .icon-btn-reject{ color:var(--rust); }

      .stamp{ display:inline-block; font-family:var(--font-mono); font-weight:700; font-size:.62rem; letter-spacing:.11em; text-transform:uppercase;
        border:1.5px solid; border-radius:4px; padding:3px 8px; transform:rotate(-2deg); background:var(--white); }
      .stamp-mini{ font-size:.56rem; padding:2px 6px; margin-left:6px; }

      .summary-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:18px; }
      .summary-card{ background:var(--white); border:1px solid var(--line); border-left:4px solid; border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:3px; }
      .summary-label{ font-size:.7rem; text-transform:uppercase; letter-spacing:.08em; color:#7C8A80; }
      .summary-value{ font-family:var(--font-display); font-size:1.7rem; font-weight:700; }

      .filter-bar{ display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
      .search-input{ display:flex; align-items:center; gap:8px; border:1px solid var(--line); border-radius:8px; padding:8px 11px; background:var(--white); color:#7C8A80; }
      .search-input input{ border:none; background:none; flex:1; font-size:.88rem; color:var(--ink); }
      .search-input input:focus{ outline:none; }
      .filter-bar select{ border:1px solid var(--line); border-radius:8px; padding:8px 11px; font-size:.85rem; background:var(--white); }

      .empty-state{ text-align:center; padding:40px 20px; color:#8B968E; font-size:.9rem; }

      .record-list{ display:flex; flex-direction:column; gap:10px; list-style:none; padding:0; margin:0; }
      .record-card{ display:flex; gap:12px; background:var(--white); border:1px solid var(--line); border-radius:12px; padding:12px; align-items:flex-start; }
      .record-card-excluido{ opacity:.6; }
      .record-info{ flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
      .record-title-row{ display:flex; align-items:center; flex-wrap:wrap; gap:4px; }
      .record-cat{ font-size:.72rem; color:var(--brass); font-weight:600; }
      .record-meta{ display:flex; flex-wrap:wrap; gap:8px; font-size:.74rem; color:#6B7A6F; margin-top:2px; }
      .record-actions{ display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0; }
      .action-row{ display:flex; gap:2px; }

      .thumb{ width:52px; height:52px; border-radius:8px; object-fit:cover; flex-shrink:0; background:var(--paper-dim); }
      .thumb-empty{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; color:#9AA69C; font-size:.55rem; text-align:center; }

      .user-list{ list-style:none; margin:0 0 8px; padding:0; display:flex; flex-direction:column; gap:8px; }
      .user-row{ display:flex; justify-content:space-between; align-items:center; gap:10px; background:var(--white); border:1px solid var(--line); border-radius:10px; padding:12px 14px; flex-wrap:wrap; }
      .user-row-inactive{ opacity:.5; }
      .user-email{ font-size:.75rem; color:#7C8A80; }
      .user-controls{ display:flex; align-items:center; gap:8px; }
      .user-controls select{ border:1px solid var(--line); border-radius:7px; padding:6px 8px; font-size:.78rem; background:var(--white); }

      .report-toolbar{ display:flex; justify-content:space-between; gap:10px; margin-bottom:14px; }
      .report-sheet{ background:var(--white); border:1px solid var(--line); border-radius:12px; padding:22px 20px; }
      .report-header{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; border-bottom:2px solid var(--red); padding-bottom:14px; margin-bottom:16px; }
      .report-meta{ display:flex; flex-direction:column; gap:2px; font-size:.74rem; color:#5A6A5D; text-align:right; }
      .report-meta strong{ color:var(--ink); font-size:.88rem; }
      .report-summary{ margin-bottom:22px; }
      .report-section{ margin-bottom:22px; }
      .report-section-title{ display:flex; justify-content:space-between; font-family:var(--font-display); font-size:1.05rem; border-left:4px solid var(--forest); padding-left:10px; margin-bottom:10px; }
      .report-section-title span{ font-family:var(--font-body); font-size:.72rem; color:#7C8A80; font-weight:500; }
      .report-empty{ font-style:italic; color:#9AA69C; font-size:.85rem; text-align:center; padding:14px; }
      .report-table{ width:100%; border-collapse:collapse; font-size:.8rem; }
      .report-table th{ text-align:left; font-size:.66rem; text-transform:uppercase; letter-spacing:.06em; color:var(--white); background:var(--red); padding:8px 10px; }
      .report-table td{ padding:9px 10px; border-bottom:1px solid var(--line); vertical-align:middle; }
      .report-table-cat{ font-size:.68rem; color:var(--brass); }
      .report-footer{ text-align:center; font-size:.68rem; color:#9AA69C; border-top:1px solid var(--line); padding-top:12px; margin-top:8px; }

      .toast{ position:fixed; bottom:96px; left:50%; transform:translateX(-50%); background:var(--ink); color:var(--white); padding:10px 18px; border-radius:30px; font-size:.82rem; z-index:50; box-shadow:0 10px 30px -12px rgba(0,0,0,.4); }
      .toast-success{ background:var(--red); }
      .toast-info{ background:#39473D; }
      .toast-error{ background:var(--rust); }

      @media (min-width:900px){
        .topbar-user-name{ display:inline; }
        .app-body{ max-width:1180px; margin:0 auto; width:100%; }
        .sidenav{ display:flex; flex-direction:column; gap:4px; width:200px; padding:20px 12px; flex-shrink:0; border-right:1px solid var(--line); }
        .sidenav-item{ display:flex; align-items:center; gap:10px; border:none; background: var(--red); padding:10px 12px; border-radius:8px; font-size:.88rem; font-weight:600; color: var(--paper); text-align:left; }
        .sidenav-item:hover{ background: #D30000; }
        .sidenav-item-active{ background:var(--red); color:var(--white); }
        .bottomnav{ display:none; }
        .content{ padding-bottom:24px; }
        .view-pad{ padding:28px 32px; }
        .summary-grid{ grid-template-columns:repeat(4,1fr); }
        .form-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .form-grid > .btn, .form-grid > .checkbox-row, .form-grid > .form-error, .form-grid > .file-input-row{ grid-column:1/-1; }
      }

      @media print{
        .no-print{ display:none !important; }
        .dkp-root, .app-shell, .app-body, .content{ background:white; padding:0; margin:0; }
        .view-pad{ padding:0; max-width:none; }
        .report-sheet{ border:none; padding:0; box-shadow:none; }
        .sidenav{ display:none; }
      }
    `}</style>
  );
}

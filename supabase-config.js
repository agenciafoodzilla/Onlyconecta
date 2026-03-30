// ═══════════════════════════════════════════════
// supabase-config.js — OnlyConecta
// ═══════════════════════════════════════════════
// ⚠️  SUBSTITUA os valores abaixo pelas suas chaves reais
// Encontre em: Supabase → Settings → API

const SUPABASE_URL      = 'https://rxrrbkpsuagdmxodykqq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cnJia3BzdWFnZG14b2R5a3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQyNjgsImV4cCI6MjA5MDQ1MDI2OH0.ZLOwMb6Kn454fNQUGrsRA4GPlmKCpn3EQ1GOofv6XcQ'

// Inicializar cliente
const { createClient } = window.supabase
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ═══════════════════════════════════════════════
// AUTH — Cadastro
// ═══════════════════════════════════════════════
async function ocSignUp(name, email, password, type) {
  const { data, error } = await _supabase.auth.signUp({
    email,
    password,
    options: { data: { name, type } }
  })
  if (error) throw error

  // Notificação de boas-vindas
  if (data.user) {
    await _supabase.from('notifications').insert({
      user_id:     data.user.id,
      title:       'Bem-vindo ao OnlyConecta! 🎉',
      description: 'Complete seu perfil para aparecer nas buscas.',
      icon:        '🎉'
    })
    localStorage.setItem('oc_user_id',   data.user.id)
    localStorage.setItem('oc_user_type', type)
    localStorage.setItem('oc_user_name', name)
  }
  return data
}

// ═══════════════════════════════════════════════
// AUTH — Login
// ═══════════════════════════════════════════════
async function ocSignIn(email, password) {
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const { data: profile } = await _supabase
    .from('profiles').select('*').eq('id', data.user.id).single()

  if (profile?.banned) {
    await _supabase.auth.signOut()
    throw new Error('Conta suspensa. Contate: contato@onlyconecta.com.br')
  }

  localStorage.setItem('oc_user_id',   profile.id)
  localStorage.setItem('oc_user_type', profile.type)
  localStorage.setItem('oc_user_name', profile.name)
  return profile
}

// ═══════════════════════════════════════════════
// AUTH — Login Social (Google / Apple)
// ═══════════════════════════════════════════════
async function ocSocialLogin(provider) {
  const { error } = await _supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + '/onlyconecta-dashboard.html' }
  })
  if (error) throw error
}

// ═══════════════════════════════════════════════
// AUTH — Logout
// ═══════════════════════════════════════════════
async function ocLogout() {
  await _supabase.auth.signOut()
  localStorage.clear()
  window.location.href = 'onlyconecta-login.html'
}

// ═══════════════════════════════════════════════
// AUTH — Verificar sessão
// ═══════════════════════════════════════════════
async function ocCheckSession() {
  const { data: { session } } = await _supabase.auth.getSession()
  if (!session) {
    window.location.href = 'onlyconecta-login.html'
    return null
  }
  const { data: profile } = await _supabase
    .from('profiles').select('*').eq('id', session.user.id).single()
  return profile
}

// ═══════════════════════════════════════════════
// PROFILES — Atualizar perfil
// ═══════════════════════════════════════════════
async function ocUpdateProfile(fields) {
  const { data: { session } } = await _supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')

  const { error } = await _supabase
    .from('profiles').update({ ...fields, updated_at: new Date() }).eq('id', session.user.id)
  if (error) throw error
}

// ═══════════════════════════════════════════════
// PROFILES — Buscar perfis
// ═══════════════════════════════════════════════
async function ocGetProfiles(type, filters = {}) {
  let query = _supabase
    .from('profiles')
    .select('*')
    .eq('type', type)
    .eq('banned', false)

  if (filters.location)  query = query.eq('location', filters.location)
  if (filters.modality)  query = query.eq('modality', filters.modality)
  if (filters.verified)  query = query.eq('verified', true)
  if (filters.niche)     query = query.contains('niche', [filters.niche])

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════
// PROPOSALS — Enviar proposta
// ═══════════════════════════════════════════════
async function ocSendProposal(toId, message) {
  const { data: { session } } = await _supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')

  const { error } = await _supabase.from('proposals').insert({
    from_id: session.user.id,
    to_id:   toId,
    message,
    status:  'new'
  })
  if (error) throw error

  // Notificar destinatário
  await _supabase.from('notifications').insert({
    user_id:     toId,
    title:       'Nova proposta recebida! 📋',
    description: 'Alguém está interessado em trabalhar com você.',
    icon:        '📋'
  })
}

// ═══════════════════════════════════════════════
// PROPOSALS — Buscar propostas do usuário
// ═══════════════════════════════════════════════
async function ocGetProposals() {
  const { data: { session } } = await _supabase.auth.getSession()
  if (!session) return []

  const { data, error } = await _supabase
    .from('proposals')
    .select('*, from_profile:profiles!from_id(name), to_profile:profiles!to_id(name)')
    .or(`from_id.eq.${session.user.id},to_id.eq.${session.user.id}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════
// CHAT — Buscar ou criar conversa
// ═══════════════════════════════════════════════
async function ocGetOrCreateConversation(otherUserId) {
  const { data: { session } } = await _supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')
  const myId = session.user.id

  // Buscar conversa existente
  const { data: existing } = await _supabase
    .from('conversations')
    .select('id')
    .or(`and(participant_1.eq.${myId},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${myId})`)
    .maybeSingle()

  if (existing) return existing.id

  // Criar nova conversa
  const { data: newConv, error } = await _supabase
    .from('conversations')
    .insert({ participant_1: myId, participant_2: otherUserId })
    .select('id').single()

  if (error) throw error
  return newConv.id
}

// ═══════════════════════════════════════════════
// CHAT — Buscar mensagens
// ═══════════════════════════════════════════════
async function ocGetMessages(conversationId) {
  const { data, error } = await _supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════
// CHAT — Enviar mensagem
// ═══════════════════════════════════════════════
async function ocSendMessage(conversationId, text) {
  const { data: { session } } = await _supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')

  const { error } = await _supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id:       session.user.id,
    text
  })
  if (error) throw error
}

// ═══════════════════════════════════════════════
// CHAT — Realtime
// ═══════════════════════════════════════════════
function ocSubscribeMessages(conversationId, callback) {
  return _supabase
    .channel('chat-' + conversationId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, payload => callback(payload.new))
    .subscribe()
}

// ═══════════════════════════════════════════════
// NOTIFICATIONS — Buscar notificações
// ═══════════════════════════════════════════════
async function ocGetNotifications() {
  const { data: { session } } = await _supabase.auth.getSession()
  if (!session) return []

  const { data, error } = await _supabase
    .from('notifications')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════
// NOTIFICATIONS — Realtime
// ═══════════════════════════════════════════════
async function ocSubscribeNotifications(callback) {
  const { data: { session } } = await _supabase.auth.getSession()
  if (!session) return

  return _supabase
    .channel('notif-' + session.user.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_id=eq.${session.user.id}`
    }, payload => callback(payload.new))
    .subscribe()
}

// ═══════════════════════════════════════════════
// NOTIFICAÇÃO — Marcar como lida
// ═══════════════════════════════════════════════
async function ocMarkNotificationRead(id) {
  await _supabase.from('notifications').update({ read: true }).eq('id', id)
}

// Exportar para uso global
window.oc = {
  signUp:                ocSignUp,
  signIn:                ocSignIn,
  socialLogin:           ocSocialLogin,
  logout:                ocLogout,
  checkSession:          ocCheckSession,
  updateProfile:         ocUpdateProfile,
  getProfiles:           ocGetProfiles,
  sendProposal:          ocSendProposal,
  getProposals:          ocGetProposals,
  getOrCreateConv:       ocGetOrCreateConversation,
  getMessages:           ocGetMessages,
  sendMessage:           ocSendMessage,
  subscribeMessages:     ocSubscribeMessages,
  getNotifications:      ocGetNotifications,
  subscribeNotifications:ocSubscribeNotifications,
  markNotifRead:         ocMarkNotificationRead,
  client:                _supabase
}

console.log('✅ OnlyConecta Supabase config carregado!')

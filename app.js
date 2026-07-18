import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://squdevioviumkvmvjkke.supabase.co',
  'sb_publishable_K0Vjk1VX7PTU3r21He4IoA_EhGhNHFV'
);

const byId = (id) => document.getElementById(id);
const message = (text, type = 'success') => {
  const target = byId('portal-message') || document.querySelector('[data-contact-status]');
  if (!target) return;
  target.textContent = text;
  target.className = type === 'error' ? 'text-red-700 mt-4' : 'text-green-700 mt-4';
};

const formatDate = (value) => new Intl.DateTimeFormat('en-ZM', {
  dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(value));

async function loadPublicEvents() {
  const container = document.querySelector('[data-dynamic-events]');
  if (!container) return;
  const { data, error } = await supabase.from('events')
    .select('id,title,description,location,starts_at,image_path')
    .eq('published', true).order('starts_at', { ascending: true }).limit(6);
  if (error || !data?.length) return;
  container.replaceChildren();
  for (const event of data) {
    const card = document.createElement('article');
    card.className = 'bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition';
    if (event.image_path) {
      const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(event.image_path);
      const image = document.createElement('img');
      image.src = urlData.publicUrl;
      image.alt = event.title;
      image.className = 'w-full h-64 object-cover';
      card.append(image);
    }
    const content = document.createElement('div');
    content.className = 'p-8';
    const title = document.createElement('h3'); title.className = 'text-2xl font-bold mb-3'; title.textContent = event.title;
    const description = document.createElement('p'); description.className = 'text-gray-600 mb-4 leading-relaxed'; description.textContent = event.description;
    const details = document.createElement('p'); details.className = 'inline-block bg-blue-100 text-primary px-4 py-2 rounded-full font-semibold';
    details.textContent = `${formatDate(event.starts_at)}${event.location ? ` | ${event.location}` : ''}`;
    content.append(title, description, details); card.append(content); container.append(card);
  }
}

async function submitContact(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  const { error } = await supabase.from('contact_messages').insert(payload);
  if (error) return message('We could not send your message. Please email us directly.', 'error');
  form.reset(); message('Thank you. Your message has been sent.');
}

async function register(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(
    Array.from(new FormData(form), ([key, value]) => [key, value === '' ? null : value])
  );
  const { password, consent, ...metadata } = values;
  const ministryInterests = Array.from(form.querySelectorAll('input[name="ministry_interests"]:checked')).map((input) => input.value);
  const { error } = await supabase.auth.signUp({
    email: values.email, password,
    options: { data: {
      ...metadata, ministry_interests: ministryInterests,
      baptized: values.baptized === 'true', previous_membership: values.previous_membership === 'true',
      transfer_requested: values.transfer_requested === 'true'
    }, emailRedirectTo: new URL('portal.html', window.location.href).toString() }
  });
  if (error) return message(error.message, 'error');
  form.reset(); message('Application received. Check your email to confirm it; church staff will then review it.');
}

async function login(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
  if (error) return message(error.message, 'error');
  await renderPortal();
}

async function approveMember(id, status) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('profiles').update({
    membership_status: status, reviewed_at: new Date().toISOString(), reviewed_by: user.id
  }).eq('id', id);
  if (error) return message(error.message, 'error');
  await renderPortal();
}

async function createEvent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const { data: { user } } = await supabase.auth.getUser();
  let image_path = null;
  const image = form.elements.image.files[0];
  if (image) {
    image_path = `${user.id}/${crypto.randomUUID()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error: uploadError } = await supabase.storage.from('event-images').upload(image_path, image, { contentType: image.type });
    if (uploadError) return message(uploadError.message, 'error');
  }
  const { error } = await supabase.from('events').insert({
    title: values.title, description: values.description, location: values.location || null,
    starts_at: new Date(values.starts_at).toISOString(), image_path,
    published: values.published === 'on', created_by: user.id
  });
  if (error) return message(error.message, 'error');
  form.reset(); message('Event saved.'); await renderPortal();
}

async function addManualMember(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(
    Array.from(new FormData(form), ([key, value]) => [key, value === '' ? null : value])
  );
  const { data: { user } } = await supabase.auth.getUser();
  const ministry_interests = Array.from(form.querySelectorAll('input[name="ministry_interests"]:checked')).map((input) => input.value);
  const { error } = await supabase.from('manual_members').insert({
    ...values, ministry_interests, created_by: user.id,
    baptized: values.baptized === 'true' ? true : values.baptized === 'false' ? false : null,
    previous_membership: values.previous_membership === 'true' ? true : values.previous_membership === 'false' ? false : null,
    children_count: values.children_count ? Number(values.children_count) : null
  });
  if (error) return message(error.message, 'error');
  form.reset(); message('Member added and approved.'); await renderPortal();
}

function portalShell(title, body) {
  const target = byId('portal-content');
  target.innerHTML = `<h1 class="text-3xl font-bold text-slate-900 mb-2">${title}</h1>${body}`;
}

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Not recorded';
  return String(value);
};

function openMemberDetails(member) {
  const backdrop = document.createElement('div');
  backdrop.className = 'detail-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  const panel = document.createElement('section');
  panel.className = 'detail-panel';
  const header = document.createElement('div'); header.className = 'detail-head';
  const heading = document.createElement('div');
  const name = document.createElement('h2'); name.className = 'text-2xl font-bold'; name.textContent = member.full_name || 'Unnamed member';
  const labels = document.createElement('p'); labels.className = 'mt-2 flex gap-2 flex-wrap';
  labels.innerHTML = `<span class="status-pill ${member.membership_status}">${member.membership_status}</span><span class="source-pill">${member.source}</span>`;
  heading.append(name, labels);
  const close = document.createElement('button'); close.className = 'secondary'; close.textContent = 'Close'; close.onclick = () => backdrop.remove();
  header.append(heading, close); panel.append(header);
  const sections = [
    ['Contact and family', [['Email', 'email'], ['Phone', 'phone'], ['Date of birth', 'date_of_birth'], ['Gender', 'gender'], ['Marital status', 'marital_status'], ['Spouse', 'spouse_name'], ['Children', 'children_count'], ['Occupation', 'occupation'], ['Home address', 'address']]],
    ['Church background', [['Baptized after profession of faith', 'baptized'], ['Baptism date', 'baptism_date'], ['Baptism church', 'baptism_church'], ['Previous membership', 'previous_membership'], ['Previous church', 'previous_church'], ['Transfer requested', 'transfer_requested'], ['Reason for leaving / transfer', 'previous_membership_reason'], ['Ministry interests', 'ministry_interests']]],
    ['Pastoral information', [['Salvation story / testimony', 'salvation_story'], ['Gospel understanding', 'gospel_understanding'], ['Repentance and faith', 'repentance_and_faith'], ['Assurance of salvation', 'assurance_of_salvation'], ['Pastoral notes', 'pastoral_notes']]],
    ['Emergency contact', [['Name', 'emergency_contact_name'], ['Phone', 'emergency_contact_phone']]]
  ];
  for (const [sectionTitle, fields] of sections) {
    const section = document.createElement('section'); section.className = 'detail-section';
    const title = document.createElement('h3'); title.className = 'font-bold text-lg'; title.textContent = sectionTitle;
    const grid = document.createElement('dl'); grid.className = 'detail-grid';
    for (const [label, key] of fields) {
      if (member[key] === null || member[key] === undefined || member[key] === '') continue;
      const item = document.createElement('div'); item.className = 'detail-item';
      const term = document.createElement('dt'); term.textContent = label;
      const definition = document.createElement('dd'); definition.textContent = displayValue(member[key]);
      item.append(term, definition); grid.append(item);
    }
    if (grid.childElementCount) { section.append(title, grid); panel.append(section); }
  }
  backdrop.append(panel);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); });
  document.body.append(backdrop); close.focus();
}

async function renderEnhancedMemberRegister() {
  const oldList = byId('member-list');
  if (!oldList) return;
  const register = oldList.parentElement;
  register.innerHTML = '<h3>Membership register</h3><p class="text-sm text-slate-600">Search the register, choose a status, then open a member record to view their submitted details.</p><div class="member-summary" id="member-summary"></div><div class="member-toolbar"><label>Search members<input id="member-search" type="search" placeholder="Name, email, or phone"></label><label>Membership status<select id="member-filter"><option value="all">All records</option><option value="pending">Pending review</option><option value="approved">Approved members</option><option value="declined">Declined</option></select></label></div><div id="member-list" class="member-list"></div>';
  const [{ data: applications, error: applicationsError }, { data: manualMembers, error: manualError }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('manual_members').select('*').order('created_at', { ascending: false })
  ]);
  if (applicationsError || manualError) {
    byId('member-list').textContent = 'The register could not be loaded. Please refresh and try again.';
    return;
  }
  const records = [
    ...(applications || []).map((member) => ({ ...member, source: 'Online application' })),
    ...(manualMembers || []).map((member) => ({ ...member, source: 'Staff entry' }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const counts = ['pending', 'approved', 'declined'].map((status) => `${records.filter((record) => record.membership_status === status).length} ${status}`);
  byId('member-summary').innerHTML = `<span class="summary-pill">${records.length} total records</span>${counts.map((count) => `<span class="summary-pill">${count}</span>`).join('')}`;
  const render = () => {
    const filter = byId('member-filter').value;
    const query = byId('member-search').value.trim().toLowerCase();
    const visible = records.filter((member) => {
      const matchesStatus = filter === 'all' || member.membership_status === filter;
      const searchable = [member.full_name, member.email, member.phone].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
    const list = byId('member-list'); list.replaceChildren();
    if (!visible.length) { list.innerHTML = '<p class="empty-state">No members match those filters.</p>'; return; }
    for (const member of visible) {
      const card = document.createElement('article'); card.className = 'member-card';
      const details = document.createElement('div');
      const title = document.createElement('h4'); title.textContent = member.full_name || 'Unnamed member';
      const badges = document.createElement('p'); badges.className = 'mt-2 flex gap-2 flex-wrap';
      badges.innerHTML = `<span class="status-pill ${member.membership_status}">${member.membership_status}</span><span class="source-pill">${member.source}</span>`;
      const contact = document.createElement('p'); contact.className = 'member-meta'; contact.textContent = [member.email, member.phone].filter(Boolean).join(' · ') || 'No contact details recorded';
      details.append(title, badges, contact);
      const actions = document.createElement('div'); actions.className = 'member-actions';
      const view = document.createElement('button'); view.className = 'outline'; view.textContent = 'View details'; view.onclick = () => openMemberDetails(member); actions.append(view);
      if (member.source === 'Online application' && member.membership_status === 'pending') {
        const approve = document.createElement('button'); approve.textContent = 'Approve'; approve.onclick = () => approveMember(member.id, 'approved');
        const decline = document.createElement('button'); decline.textContent = 'Decline'; decline.className = 'secondary'; decline.onclick = () => approveMember(member.id, 'declined');
        actions.append(approve, decline);
      }
      card.append(details, actions); list.append(card);
    }
  };
  byId('member-filter').addEventListener('change', render);
  byId('member-search').addEventListener('input', render);
  render();
}

async function renderPortal() {
  if (!byId('portal-content')) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    portalShell('Member portal', `<p class="text-slate-600 mb-6">Register to apply for membership, or sign in to check your application.</p>
      <div class="grid md:grid-cols-2 gap-8"><form id="login-form" class="card"><h2>Sign in</h2><input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required><button>Sign in</button></form>
      <form id="register-form" class="card"><h2>Apply for membership</h2><p class="text-sm text-slate-600">Your information is reviewed only by authorized church staff.</p>
      <h3>Personal details</h3><input name="full_name" placeholder="Full name" required><input name="date_of_birth" type="date" required><select name="gender" required><option value="">Gender</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select><input name="phone" placeholder="Phone number" required><input name="email" type="email" placeholder="Email" required><textarea name="address" placeholder="Home address" required></textarea>
      <h3>Family and work</h3><select name="marital_status" required><option value="">Marital status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select><input name="spouse_name" placeholder="Spouse name (if applicable)"><input name="children_count" type="number" min="0" placeholder="Number of children"><input name="occupation" placeholder="Occupation / work">
      <h3>Church background</h3><label>Have you been baptized by immersion after professing faith?</label><select name="baptized" required><option value="">Select one</option><option value="true">Yes</option><option value="false">No</option></select><input name="baptism_date" type="date" placeholder="Baptism date"><input name="baptism_church" placeholder="Church where baptized"><label>Have you previously been a church member?</label><select name="previous_membership" required><option value="">Select one</option><option value="true">Yes</option><option value="false">No</option></select><input name="previous_church" placeholder="Previous church (if applicable)"><textarea name="previous_membership_reason" placeholder="Why did you leave or seek transfer from the previous church?"></textarea><label class="check"><input name="transfer_requested" type="checkbox" value="true"> I am requesting a membership transfer</label>
      <h3>Your testimony</h3><p class="text-sm text-slate-600">These questions support a pastoral conversation; only God knows the heart.</p><textarea name="salvation_story" placeholder="Please share how you came to trust in Jesus Christ." required></textarea><textarea name="gospel_understanding" placeholder="In your own words, what is the gospel?" required></textarea><textarea name="repentance_and_faith" placeholder="What do repentance and faith in Christ mean to you?" required></textarea><textarea name="assurance_of_salvation" placeholder="On what basis do you have assurance of salvation?" required></textarea>
      <h3>Ministry and emergency contact</h3><fieldset><legend>Ministry interests</legend><label class="check"><input name="ministry_interests" type="checkbox" value="Children"> Children</label><label class="check"><input name="ministry_interests" type="checkbox" value="Youth"> Youth</label><label class="check"><input name="ministry_interests" type="checkbox" value="Music"> Music</label><label class="check"><input name="ministry_interests" type="checkbox" value="Evangelism"> Evangelism</label><label class="check"><input name="ministry_interests" type="checkbox" value="Hospitality"> Hospitality</label></fieldset><input name="emergency_contact_name" placeholder="Emergency contact name" required><input name="emergency_contact_phone" placeholder="Emergency contact phone" required><input name="password" type="password" minlength="8" placeholder="Password (8+ characters)" required><label class="check"><input name="consent" type="checkbox" required> I consent to Sentinel Baptist Church securely using this information for membership and pastoral care.</label><button>Submit application</button></form></div>`);
    byId('login-form').addEventListener('submit', login); byId('register-form').addEventListener('submit', register); return;
  }
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) return message('Your profile is still being prepared. Please refresh shortly.', 'error');
  const staff = ['staff', 'admin'].includes(profile.role);
  portalShell(`Welcome, ${profile.full_name || user.email}`, `<p class="text-slate-600 mb-4">Membership status: <strong class="capitalize">${profile.membership_status}</strong></p><button id="sign-out" class="secondary">Sign out</button><div id="staff-area" class="mt-8"></div>`);
  byId('sign-out').addEventListener('click', async () => { await supabase.auth.signOut(); await renderPortal(); });
  if (!staff) return;
  const area = byId('staff-area');
  area.innerHTML = `<h2 class="text-2xl font-bold mt-8">Staff dashboard</h2><div class="grid lg:grid-cols-2 gap-8 mt-5"><section class="card"><h3>Add a member manually</h3><p class="text-sm text-slate-600">Manual entries are approved immediately and do not need an online account.</p><form id="manual-member-form"><input name="full_name" placeholder="Full name" required><input name="email" type="email" placeholder="Email (optional)"><input name="phone" placeholder="Phone number"><input name="date_of_birth" type="date"><select name="gender"><option value="">Gender</option><option>Female</option><option>Male</option></select><select name="marital_status"><option value="">Marital status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select><input name="spouse_name" placeholder="Spouse name"><input name="children_count" type="number" min="0" placeholder="Number of children"><input name="occupation" placeholder="Occupation"><textarea name="address" placeholder="Home address"></textarea><select name="baptized"><option value="">Baptized?</option><option value="true">Yes</option><option value="false">No</option></select><input name="baptism_church" placeholder="Church where baptized"><select name="previous_membership"><option value="">Previous church membership?</option><option value="true">Yes</option><option value="false">No</option></select><input name="previous_church" placeholder="Previous church"><textarea name="salvation_story" placeholder="Salvation story / testimony"></textarea><textarea name="pastoral_notes" placeholder="Private pastoral notes"></textarea><fieldset><legend>Ministry interests</legend><label class="check"><input name="ministry_interests" type="checkbox" value="Children"> Children</label><label class="check"><input name="ministry_interests" type="checkbox" value="Youth"> Youth</label><label class="check"><input name="ministry_interests" type="checkbox" value="Music"> Music</label><label class="check"><input name="ministry_interests" type="checkbox" value="Evangelism"> Evangelism</label></fieldset><input name="emergency_contact_name" placeholder="Emergency contact name"><input name="emergency_contact_phone" placeholder="Emergency contact phone"><button>Add approved member</button></form></section><section class="card"><h3>Publish an event</h3><form id="event-form"><input name="title" placeholder="Event title" required><textarea name="description" placeholder="Description" required></textarea><input name="location" placeholder="Location"><input name="starts_at" type="datetime-local" required><input name="image" type="file" accept="image/jpeg,image/png,image/webp"><label class="check"><input name="published" type="checkbox" checked> Publish immediately</label><button>Save event</button></form></section></div><section class="card mt-8"><h3>Membership register</h3><label>Filter members<select id="member-filter"><option value="all">All members and applications</option><option value="pending">Pending review</option><option value="approved">Approved</option><option value="declined">Declined</option></select></label><div id="member-list">Loading…</div></section>`;
  byId('event-form').addEventListener('submit', createEvent);
  byId('manual-member-form').addEventListener('submit', addManualMember);
  const [{ data: applications }, { data: manualMembers }] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,phone,membership_status,created_at').order('created_at', { ascending: false }),
    supabase.from('manual_members').select('id,full_name,email,phone,membership_status,created_at').order('created_at', { ascending: false })
  ]);
  const records = [...(applications || []).map((member) => ({ ...member, source: 'Online application' })), ...(manualMembers || []).map((member) => ({ ...member, source: 'Staff entry' }))];
  const list = byId('member-list');
  const renderMemberList = () => {
    const filter = byId('member-filter').value;
    list.replaceChildren();
    const visible = records.filter((record) => filter === 'all' || record.membership_status === filter);
    if (!visible.length) { list.textContent = 'No records match this filter.'; return; }
    for (const application of visible) {
    const row = document.createElement('div'); row.className = 'application';
      const info = document.createElement('p'); info.textContent = `${application.full_name || 'Unnamed'} — ${application.membership_status} · ${application.source}${application.email ? ` · ${application.email}` : ''}${application.phone ? ` · ${application.phone}` : ''}`;
      row.append(info);
      if (application.source === 'Online application' && application.membership_status === 'pending') {
        const approve = document.createElement('button'); approve.textContent = 'Approve'; approve.onclick = () => approveMember(application.id, 'approved');
        const decline = document.createElement('button'); decline.textContent = 'Decline'; decline.className = 'secondary'; decline.onclick = () => approveMember(application.id, 'declined');
        row.append(approve, decline);
      }
      list.append(row);
    }
  };
  byId('member-filter').addEventListener('change', renderMemberList); renderMemberList();
  await renderEnhancedMemberRegister();
}

document.querySelector('[data-contact-form]')?.addEventListener('submit', submitContact);
loadPublicEvents(); renderPortal();

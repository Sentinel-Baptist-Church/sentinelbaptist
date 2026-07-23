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

const friendlyAuthMessage = (error) => {
  const text = error?.message || 'Something went wrong. Please try again.';
  if (/invalid login credentials/i.test(text)) return 'We could not match that email and password. Please check them and try again.';
  if (/email not confirmed/i.test(text)) return 'Please confirm your email first, then return here to sign in.';
  if (/already registered/i.test(text)) return 'An account already exists for that email. Please sign in instead.';
  if (/password should be at least/i.test(text)) return 'Please choose a password with at least 8 characters.';
  return text;
};

const formFeedback = (form, text, type = 'success') => {
  let target = form.querySelector('[data-form-feedback]');
  if (!target) {
    target = document.createElement('p');
    target.dataset.formFeedback = '';
    target.setAttribute('aria-live', 'polite');
    form.append(target);
  }
  target.textContent = text;
  target.className = `form-feedback ${type}`;
};

const setFormLoading = (form, loading, label) => {
  const button = form.querySelector('button[type="submit"], button:not([type])');
  if (!button) return;
  if (loading) {
    button.dataset.originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalLabel || button.textContent;
  }
};

// Convert placeholder-only controls in the long membership application into
// persistent labels. This makes the form easier to scan and keeps each field
// understandable after someone starts typing.
const addVisibleFieldLabels = (form) => {
  const labels = {
    full_name: 'Full name', date_of_birth: 'Date of birth', gender: 'Gender',
    phone: 'Phone number', email: 'Email address', address: 'Home address',
    marital_status: 'Marital status', spouse_name: 'Spouse name (if applicable)',
    children_count: 'Number of children', occupation: 'Occupation / work',
    baptism_date: 'Baptism date', baptism_church: 'Church where baptized',
    previous_church: 'Previous church (if applicable)',
    previous_membership_reason: 'Reason for leaving or transfer',
    salvation_story: 'How did you come to trust in Jesus Christ?',
    gospel_understanding: 'What is the gospel, in your own words?',
    repentance_and_faith: 'What do repentance and faith in Christ mean to you?',
    assurance_of_salvation: 'What is the basis of your assurance of salvation?',
    emergency_contact_name: 'Emergency contact name',
    emergency_contact_phone: 'Emergency contact phone'
  };
  form.querySelectorAll('input, textarea, select').forEach((control) => {
    if (control.type === 'checkbox' || control.closest('label')) return;
    const text = labels[control.name] || control.getAttribute('placeholder');
    if (!text) return;
    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = text;
    control.parentNode.insertBefore(label, control);
    label.append(control);
  });
  form.querySelectorAll('.field-label, .check').forEach((label) => {
    if (!label.querySelector('[required]') || label.querySelector('.required-indicator')) return;
    const mark = document.createElement('span');
    mark.className = 'required-indicator';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '*';
    label.insertBefore(mark, label.querySelector('input, textarea, select'));
  });
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
  formFeedback(form, '');
  setFormLoading(form, true, 'Submitting application…');
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
  setFormLoading(form, false);
  if (error) return formFeedback(form, friendlyAuthMessage(error), 'error');
  form.reset();
  formFeedback(form, 'Application received. Please check your email to confirm it; church staff will then review it.', 'success');
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  formFeedback(form, '');
  setFormLoading(form, true, 'Signing you in…');
  const values = Object.fromEntries(new FormData(form));
  const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
  setFormLoading(form, false);
  if (error) return formFeedback(form, friendlyAuthMessage(error), 'error');
  byId('login-modal')?.remove();
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

function openMemberEditor(member) {
  const backdrop = document.createElement('div'); backdrop.className = 'detail-backdrop';
  const panel = document.createElement('section'); panel.className = 'detail-panel';
  panel.innerHTML = '<div class="detail-head"><div><p class="eyebrow">Staff-only record</p><h2 class="text-2xl font-bold">Edit member</h2></div><button class="secondary" type="button">Close</button></div><form id="member-edit-form" class="form-grid mt-5"></form>';
  const form = panel.querySelector('form');
  const fields = [['full_name', 'Full name', 'text'], ['email', 'Email address', 'email'], ['phone', 'Phone number', 'text'], ['address', 'Home address', 'textarea'], ['occupation', 'Occupation', 'text'], ['pastoral_notes', 'Private pastoral notes', 'textarea']];
  for (const [key, label, type] of fields) {
    const wrapper = document.createElement('label'); wrapper.className = 'field-label'; wrapper.textContent = label;
    const control = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    control.name = key;
    control.value = member[key] || '';
    if (type !== 'textarea') control.type = type;
    wrapper.append(control); form.append(wrapper);
  }
  const statusLabel = document.createElement('label'); statusLabel.className = 'field-label'; statusLabel.textContent = 'Membership status';
  const status = document.createElement('select'); status.name = 'membership_status'; ['pending', 'approved', 'declined'].forEach((value) => { const option = new Option(value[0].toUpperCase() + value.slice(1), value, false, member.membership_status === value); status.append(option); });
  statusLabel.append(status); form.append(statusLabel);
  const feedback = document.createElement('p'); feedback.className = 'form-feedback'; feedback.dataset.formFeedback = ''; form.append(feedback);
  const save = document.createElement('button'); save.textContent = 'Save changes'; save.type = 'submit'; form.append(save);
  const close = () => backdrop.remove(); panel.querySelector('button').onclick = close;
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); setFormLoading(form, true, 'Saving changes…');
    const values = Object.fromEntries(new FormData(form));
    const table = member.source === 'Staff entry' ? 'manual_members' : 'profiles';
    const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value]));
    if (!payload.full_name) { setFormLoading(form, false); return formFeedback(form, 'A member name is required.', 'error'); }
    if (table === 'profiles' && !payload.email) { setFormLoading(form, false); return formFeedback(form, 'An online member record must have an email address.', 'error'); }
    if (table === 'profiles' && values.membership_status !== member.membership_status) {
      const { data: { user } } = await supabase.auth.getUser(); payload.reviewed_at = new Date().toISOString(); payload.reviewed_by = user.id;
    }
    const { data, error } = await supabase.from(table).update(payload).eq('id', member.id).select('id').maybeSingle();
    setFormLoading(form, false);
    if (error || !data) return formFeedback(form, `Could not save changes: ${error?.message || 'You do not have permission to update this record.'}`, 'error');
    close(); message('Member record updated.'); await renderPortal();
  });
  backdrop.append(panel); backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); }); document.body.append(backdrop);
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
      const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Edit'; edit.onclick = () => openMemberEditor(member); actions.append(edit);
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

const manualMemberForm = () => `<section class="card form-card"><p class="eyebrow">Staff entry</p><h2>Add a member</h2><p class="text-slate-600">Staff-added members are approved immediately. Fields may be completed as information is available.</p><form id="manual-member-form" class="form-grid"><input name="full_name" placeholder="Full name" required><input name="email" type="email" placeholder="Email address (optional)"><input name="phone" placeholder="Phone number"><input name="date_of_birth" type="date"><select name="gender"><option value="">Gender</option><option>Female</option><option>Male</option></select><select name="marital_status"><option value="">Marital status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select><input name="spouse_name" placeholder="Spouse name"><input name="children_count" type="number" min="0" placeholder="Number of children"><input name="occupation" placeholder="Occupation"><textarea name="address" placeholder="Home address"></textarea><select name="baptized"><option value="">Baptized?</option><option value="true">Yes</option><option value="false">No</option></select><input name="baptism_church" placeholder="Church where baptized"><select name="previous_membership"><option value="">Previous church membership?</option><option value="true">Yes</option><option value="false">No</option></select><input name="previous_church" placeholder="Previous church"><textarea name="salvation_story" placeholder="Salvation story / testimony"></textarea><textarea name="pastoral_notes" placeholder="Private pastoral notes"></textarea><fieldset><legend>Ministry interests</legend><label class="check"><input name="ministry_interests" type="checkbox" value="Children"> Children</label><label class="check"><input name="ministry_interests" type="checkbox" value="Youth"> Youth</label><label class="check"><input name="ministry_interests" type="checkbox" value="Music"> Music</label><label class="check"><input name="ministry_interests" type="checkbox" value="Evangelism"> Evangelism</label></fieldset><input name="emergency_contact_name" placeholder="Emergency contact name"><input name="emergency_contact_phone" placeholder="Emergency contact phone"><div class="form-actions"><button>Add approved member</button></div></form></section>`;

const eventForm = () => `<section class="card form-card"><p class="eyebrow">Church calendar</p><h2>Publish an event</h2><p class="text-slate-600">Create an event now; publish it immediately or save it for later.</p><form id="event-form"><input name="title" placeholder="Event title" required><textarea name="description" placeholder="Description" required></textarea><input name="location" placeholder="Location"><label class="field-label">Date and time<input name="starts_at" type="datetime-local" required></label><label class="field-label">Event image<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="check"><input name="published" type="checkbox" checked> Publish immediately</label><div class="form-actions"><button>Save event</button></div></form></section>`;

async function renderStaffDashboard(role) {
  const canManageMembers = ['staff', 'admin', 'pastor', 'membership'].includes(role);
  const canManageEvents = ['staff', 'admin', 'events'].includes(role);
  const area = byId('staff-area');
  area.innerHTML = `<section class="dashboard-shell"><div class="dashboard-heading"><div><p class="eyebrow">Church administration</p><h2>Staff dashboard</h2><p>Manage the areas assigned to your role.</p></div></div><nav class="dashboard-nav" aria-label="Staff dashboard"><button class="nav-link" data-page="overview">Overview</button>${canManageMembers ? '<button class="nav-link" data-page="members">Members</button><button class="nav-link" data-page="add-member">Add member</button>' : ''}${canManageEvents ? '<button class="nav-link" data-page="events">Events</button>' : ''}</nav><div id="dashboard-page" class="dashboard-page"></div></section>`;
  const showPage = async (pageName) => {
    document.querySelectorAll('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.page === pageName));
    const page = byId('dashboard-page');
    if (pageName === 'members' && canManageMembers) {
      page.innerHTML = '<section class="card" id="member-register-card"><div id="member-list">Loading members…</div></section>';
      await renderEnhancedMemberRegister();
      return;
    }
    if (pageName === 'add-member' && canManageMembers) {
      page.innerHTML = manualMemberForm();
      byId('manual-member-form').addEventListener('submit', addManualMember);
      return;
    }
    if (pageName === 'events' && canManageEvents) {
      page.innerHTML = eventForm();
      byId('event-form').addEventListener('submit', createEvent);
      return;
    }
    if (!canManageMembers) { page.innerHTML = '<section class="card"><p class="eyebrow">Your role</p><h2>Events Editor</h2><p class="text-slate-600">You can create and manage church events. Membership records are protected and are not available to this role.</p><div class="quick-actions"><button data-go="events">Create an event</button></div></section>'; page.querySelector('[data-go]').onclick = () => showPage('events'); return; }
    page.innerHTML = `<section class="card"><p class="eyebrow">At a glance</p><h2>Membership overview</h2><div id="overview-stats" class="stat-grid"><p class="empty-state">Loading membership totals…</p></div><div class="quick-actions"><button class="outline" data-go="members">View member register</button><button data-go="add-member">Add a member</button>${canManageEvents ? '<button class="secondary" data-go="events">Create an event</button>' : ''}</div></section>`;
    const [{ data: applications }, { data: manualMembers }] = await Promise.all([
      supabase.from('profiles').select('membership_status'),
      supabase.from('manual_members').select('membership_status')
    ]);
    const records = [...(applications || []), ...(manualMembers || [])];
    const stats = [['Total records', records.length], ['Pending review', records.filter((record) => record.membership_status === 'pending').length], ['Approved members', records.filter((record) => record.membership_status === 'approved').length]];
    byId('overview-stats').innerHTML = stats.map(([label, number]) => `<article class="stat-card"><strong>${number}</strong><span>${label}</span></article>`).join('');
    page.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.go)));
  };
  area.querySelectorAll('.nav-link').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.page)));
  await showPage('overview');
}

function renderPublicPortal() {
  portalShell('Member portal', `
    <section class="auth-shell">
      <aside class="auth-welcome"><p class="eyebrow">Sentinel Baptist Church</p><h2>A thoughtful place to begin.</h2><p>Apply for membership, check your application, and stay connected with church staff.</p><div class="auth-welcome-note"><strong>Your information is private.</strong><span>Membership details are reviewed only by authorised church staff.</span></div></aside>
      <div class="auth-forms">
        <form id="login-form" class="card auth-card"><p class="eyebrow">Returning member</p><h2>Sign in</h2><p class="text-slate-600">Use your email and password to continue.</p><label class="field-label">Email address<input name="email" type="email" autocomplete="email" placeholder="e.g. you@example.com" required></label><label class="field-label">Password<input name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required></label><button class="auth-submit">Sign in securely</button></form>
        <form id="register-form" class="card registration-card">
          <p class="eyebrow">New application</p><h2>Apply for membership</h2><p class="text-slate-600">Please complete the form below. You can expect a pastoral review after confirming your email.</p>
          <section class="form-section"><h3>Personal details</h3><div class="form-grid"><input name="full_name" placeholder="e.g. Grace Mwansa" required><input name="date_of_birth" type="date" required><select name="gender" required><option value="">Select your gender</option><option>Female</option><option>Male</option></select><input name="phone" placeholder="e.g. +260 97 123 4567" required><input name="email" type="email" placeholder="e.g. you@example.com" required><textarea name="address" placeholder="e.g. Plot 12, Kalumbila, North-Western Province" required></textarea></div></section>
          <section class="form-section"><h3>Family and work</h3><div class="form-grid"><select name="marital_status" required><option value="">Select your marital status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select><input name="spouse_name" placeholder="Full name, if married"><input name="children_count" type="number" min="0" placeholder="e.g. 2"><input name="occupation" placeholder="e.g. Teacher, student, or business owner"></div></section>
          <section class="form-section"><h3>Church background</h3><div class="form-grid"><label class="field-label">Have you been baptized by immersion after professing faith?<select name="baptized" required><option value="">Select one</option><option value="true">Yes</option><option value="false">No</option></select></label><input name="baptism_date" type="date"><input name="baptism_church" placeholder="e.g. Grace Baptist Church, Lusaka"><label class="field-label">Have you previously been a church member?<select name="previous_membership" required><option value="">Select one</option><option value="true">Yes</option><option value="false">No</option></select></label><input name="previous_church" placeholder="Name of your previous church, if applicable"><textarea name="previous_membership_reason" placeholder="Briefly explain your move, relocation, or reason for leaving."></textarea></div></section>
          <section class="form-section"><h3>Your testimony</h3><p class="section-help">These questions guide a pastoral conversation; only God knows the heart.</p><textarea name="salvation_story" placeholder="Tell us briefly about when and how you came to faith in Christ." required></textarea><textarea name="gospel_understanding" placeholder="Summarise the good news of Jesus Christ in your own words." required></textarea><textarea name="repentance_and_faith" placeholder="Describe what turning from sin and trusting Christ means to you." required></textarea><textarea name="assurance_of_salvation" placeholder="Share what gives you confidence in your salvation." required></textarea></section>
          <section class="form-section"><h3>Ministry and emergency contact</h3><fieldset><legend>Ministry interests</legend><label class="check"><input name="ministry_interests" type="checkbox" value="Children"> Children</label><label class="check"><input name="ministry_interests" type="checkbox" value="Youth"> Youth</label><label class="check"><input name="ministry_interests" type="checkbox" value="Music"> Music</label><label class="check"><input name="ministry_interests" type="checkbox" value="Evangelism"> Evangelism</label><label class="check"><input name="ministry_interests" type="checkbox" value="Hospitality"> Hospitality</label><label class="check"><input name="ministry_interests" type="checkbox" value="Media"> Media</label></fieldset><div class="form-grid"><input name="emergency_contact_name" placeholder="e.g. Ruth Mwansa" required><input name="emergency_contact_phone" placeholder="e.g. +260 96 765 4321" required></div></section>
          <section class="form-section final-section"><h3>Create your sign-in</h3><label class="field-label">Password<input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters; use a memorable, secure password" required></label><label class="check"><input name="consent" type="checkbox" required> I consent to Sentinel Baptist Church securely using this information for membership and pastoral care.</label><button class="auth-submit">Submit membership application</button></section>
        </form>
      </div>
    </section>`);
  byId('login-form').addEventListener('submit', login);
  byId('register-form').addEventListener('submit', register);
  const signInForm = byId('login-form');
  const registrationForm = byId('register-form');
  addVisibleFieldLabels(registrationForm);
  const requiredNote = document.createElement('p');
  requiredNote.className = 'required-note';
  requiredNote.innerHTML = '<span aria-hidden="true">*</span> Required fields';
  registrationForm.querySelector('.text-slate-600')?.after(requiredNote);
  document.querySelector('.auth-welcome')?.remove();
  signInForm.remove();
  document.querySelector('.auth-shell')?.classList.add('registration-only');
  const signInPrompt = document.createElement('div');
  signInPrompt.className = 'sign-in-prompt';
  signInPrompt.innerHTML = '<span>Already have an account?</span><button type="button" class="text-button" id="open-login">Sign in</button>';
  registrationForm.querySelector('.text-slate-600')?.after(signInPrompt);
  const modal = document.createElement('div');
  modal.className = 'login-modal';
  modal.id = 'login-modal';
  modal.innerHTML = '<section class="login-modal-card" role="dialog" aria-modal="true" aria-labelledby="login-modal-title"><button type="button" class="modal-close" id="close-login" aria-label="Close sign in">×</button><p class="eyebrow">Welcome back</p><h2 id="login-modal-title">Sign in</h2><p>Use your email and password to access your member portal.</p><form id="modal-login-form"><label class="field-label">Email address<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label><label class="field-label">Password<input name="password" type="password" autocomplete="current-password" placeholder="Your password" required></label><button class="auth-submit">Sign in securely</button></form></section>';
  document.body.append(modal);
  const closeModal = () => { modal.classList.remove('open'); byId('modal-login-form')?.reset(); formFeedback(byId('modal-login-form'), ''); };
  byId('open-login').addEventListener('click', () => { modal.classList.add('open'); modal.querySelector('input')?.focus(); });
  byId('close-login').addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  modal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
  byId('modal-login-form').addEventListener('submit', login);
}

async function renderPortal() {
  if (!byId('portal-content')) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    renderPublicPortal();
    return;
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
  const staff = ['staff', 'admin', 'pastor', 'membership', 'events'].includes(profile.role);
  portalShell(`Welcome, ${profile.full_name || user.email}`, `<p class="text-slate-600 mb-4">Membership status: <strong class="capitalize">${profile.membership_status}</strong></p><button id="sign-out" class="secondary">Sign out</button><div id="staff-area" class="mt-8"></div>`);
  byId('sign-out').addEventListener('click', async () => { await supabase.auth.signOut(); await renderPortal(); });
  if (!staff) return;
  await renderStaffDashboard(profile.role);
  return;
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

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
  const values = Object.fromEntries(new FormData(form));
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

function portalShell(title, body) {
  const target = byId('portal-content');
  target.innerHTML = `<h1 class="text-3xl font-bold text-slate-900 mb-2">${title}</h1>${body}`;
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
  area.innerHTML = `<h2 class="text-2xl font-bold mt-8">Staff dashboard</h2><div class="grid lg:grid-cols-2 gap-8 mt-5"><section class="card"><h3>Publish an event</h3><form id="event-form"><input name="title" placeholder="Event title" required><textarea name="description" placeholder="Description" required></textarea><input name="location" placeholder="Location"><input name="starts_at" type="datetime-local" required><input name="image" type="file" accept="image/jpeg,image/png,image/webp"><label class="check"><input name="published" type="checkbox" checked> Publish immediately</label><button>Save event</button></form></section><section class="card"><h3>Pending membership applications</h3><div id="applications">Loading…</div></section></div>`;
  byId('event-form').addEventListener('submit', createEvent);
  const { data: pending } = await supabase.from('profiles').select('id,full_name,email,phone,created_at').eq('membership_status', 'pending').order('created_at');
  const list = byId('applications'); list.replaceChildren();
  if (!pending?.length) list.textContent = 'No pending applications.';
  for (const application of pending || []) {
    const row = document.createElement('div'); row.className = 'application';
    const info = document.createElement('p'); info.textContent = `${application.full_name || 'Unnamed'} — ${application.email}${application.phone ? ` · ${application.phone}` : ''}`;
    const approve = document.createElement('button'); approve.textContent = 'Approve'; approve.onclick = () => approveMember(application.id, 'approved');
    const decline = document.createElement('button'); decline.textContent = 'Decline'; decline.className = 'secondary'; decline.onclick = () => approveMember(application.id, 'declined');
    row.append(info, approve, decline); list.append(row);
  }
}

document.querySelector('[data-contact-form]')?.addEventListener('submit', submitContact);
loadPublicEvents(); renderPortal();

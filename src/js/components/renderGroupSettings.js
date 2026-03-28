import { activeGroup, allGroups, currentUsername, createGroupInvite, joinGroup, fetchGroupMembers, switchGroup } from '../data/index.js';
import { btn } from '../ui/elements.js';
import { toastError } from '../ui/toast.js';

export function renderGroupSettings() {
  const container = document.getElementById('app-content');
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.className = 'text-xl font-bold text-gray-900 mb-1';
  heading.textContent = 'Group';
  container.appendChild(heading);

  if (!activeGroup) {
    const p = document.createElement('p');
    p.className = 'text-sm text-gray-400';
    p.textContent = 'No group loaded.';
    container.appendChild(p);
    return;
  }

  // ── Group switcher (shown when the user belongs to more than one) ──
  if (allGroups.length > 1) {
    const switchLabel = document.createElement('span');
    switchLabel.className = 'section-label';
    switchLabel.textContent = 'Active group';
    container.appendChild(switchLabel);

    const switchCard = document.createElement('div');
    switchCard.className = 'card mb-4 space-y-1';

    allGroups.forEach(group => {
      const row = document.createElement('button');
      row.type = 'button';
      const isActive = group.groupId === activeGroup.groupId;
      row.className = `w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
        isActive ? 'bg-green-50 text-green-800 font-semibold' : 'text-gray-700 hover:bg-gray-50'
      }`;

      const nameEl = document.createElement('span');
      nameEl.textContent = group.name;
      row.appendChild(nameEl);

      if (isActive) {
        const badge = document.createElement('span');
        badge.className = 'text-xs text-green-600';
        badge.textContent = 'active';
        row.appendChild(badge);
      }

      row.onclick = async () => {
        if (isActive) return;
        row.disabled = true;
        row.textContent = 'Switching…';
        try {
          await switchGroup(group.groupId);
          renderGroupSettings(); // re-render with new active group
        } catch {
          toastError('Could not switch group. Try again.');
          renderGroupSettings();
        }
      };

      switchCard.appendChild(row);
    });

    container.appendChild(switchCard);
  }

  // Active group name + ID
  const groupCard = document.createElement('div');
  groupCard.className = 'card mb-4';

  const groupName = document.createElement('p');
  groupName.className = 'font-semibold text-gray-800 mb-1';
  groupName.textContent = activeGroup.name;
  groupCard.appendChild(groupName);

  const groupIdEl = document.createElement('p');
  groupIdEl.className = 'text-xs text-gray-400 font-mono';
  groupIdEl.textContent = `ID: ${activeGroup.groupId}`;
  groupCard.appendChild(groupIdEl);

  if (currentUsername) {
    const usernameEl = document.createElement('p');
    usernameEl.className = 'text-xs text-gray-400 mt-1';
    usernameEl.textContent = `Your username: ${currentUsername}`;
    groupCard.appendChild(usernameEl);
  }

  container.appendChild(groupCard);

  // Members section
  const membersLabel = document.createElement('span');
  membersLabel.className = 'section-label';
  membersLabel.textContent = 'Members';
  container.appendChild(membersLabel);

  const membersList = document.createElement('div');
  membersList.className = 'card mb-4';
  membersList.textContent = 'Loading members…';
  container.appendChild(membersList);

  fetchGroupMembers(activeGroup.groupId)
    .then(({ members }) => {
      membersList.innerHTML = '';
      members.forEach(m => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between py-1';
        const name = document.createElement('span');
        name.className = 'text-sm text-gray-700';
        name.textContent = m.userId;
        const role = document.createElement('span');
        role.className = 'text-xs text-gray-400 capitalize';
        role.textContent = m.role;
        row.appendChild(name);
        row.appendChild(role);
        membersList.appendChild(row);
      });
    })
    .catch(() => { membersList.textContent = 'Could not load members.'; });

  // Invite section
  const inviteLabel = document.createElement('span');
  inviteLabel.className = 'section-label';
  inviteLabel.textContent = 'Invite someone';
  container.appendChild(inviteLabel);

  const inviteCard = document.createElement('div');
  inviteCard.className = 'card mb-4';

  const inviteDesc = document.createElement('p');
  inviteDesc.className = 'text-sm text-gray-600 mb-3';
  inviteDesc.textContent = 'Generate a 6-character code that expires in 7 days. Share it with the person you want to invite.';
  inviteCard.appendChild(inviteDesc);

  const inviteBtn = btn('Generate invite code', 'secondary');
  inviteBtn.className += ' w-full';
  let inviteResult = null;

  inviteBtn.onclick = async () => {
    inviteBtn.disabled = true;
    inviteBtn.textContent = 'Generating…';
    try {
      const result = await createGroupInvite(activeGroup.groupId);
      inviteResult = result;
      inviteBtn.remove();
      showInviteCode(inviteCard, result);
    } catch (err) {
      toastError('Could not generate invite. Try again.');
      inviteBtn.disabled = false;
      inviteBtn.textContent = 'Generate invite code';
    }
  };

  inviteCard.appendChild(inviteBtn);
  container.appendChild(inviteCard);

  // Join section
  const joinLabel = document.createElement('span');
  joinLabel.className = 'section-label';
  joinLabel.textContent = 'Join a group';
  container.appendChild(joinLabel);

  const joinCard = document.createElement('div');
  joinCard.className = 'card mb-4';

  const codeInput = document.createElement('input');
  codeInput.type = 'text';
  codeInput.placeholder = 'Enter invite code (e.g. K7M2XP)';
  codeInput.className = 'field mb-3 uppercase';
  codeInput.maxLength = 6;
  joinCard.appendChild(codeInput);

  const joinBtn = btn('Join group', 'primary');
  joinBtn.className += ' w-full';
  joinBtn.onclick = async () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 6) { toastError('Enter a 6-character code.'); return; }
    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining…';
    try {
      const { group } = await joinGroup(code);
      joinCard.innerHTML = '';
      const success = document.createElement('p');
      success.className = 'text-sm text-green-700 font-medium mb-3';
      success.textContent = `Joined "${group.name}"!`;
      joinCard.appendChild(success);

      const switchBtn = btn(`Switch to "${group.name}"`, 'primary');
      switchBtn.onclick = async () => {
        await switchGroup(group.groupId);
        renderGroupSettings();
      };
      joinCard.appendChild(switchBtn);
    } catch (err) {
      toastError(err.message || 'Could not join. Check the code and try again.');
      joinBtn.disabled = false;
      joinBtn.textContent = 'Join group';
    }
  };

  joinCard.appendChild(joinBtn);
  container.appendChild(joinCard);
}

function showInviteCode(card, { code, expiresAt }) {
  const codeDisplay = document.createElement('div');
  codeDisplay.className = 'flex items-center gap-3 mb-2';

  const codeEl = document.createElement('span');
  codeEl.className = 'text-3xl font-mono font-bold text-green-700 tracking-widest';
  codeEl.textContent = code;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'text-xs text-gray-500 hover:text-green-600 border border-gray-200 rounded px-2 py-1';
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(code).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });
  };

  codeDisplay.appendChild(codeEl);
  codeDisplay.appendChild(copyBtn);
  card.appendChild(codeDisplay);

  const expiry = document.createElement('p');
  expiry.className = 'text-xs text-gray-400';
  expiry.textContent = `Expires ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  card.appendChild(expiry);
}

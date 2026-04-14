// DOM rendering helpers. Consumes values from reconcile.js.

const UI = {
  platformBody: () => document.getElementById('platformTableBody'),
  bankBody: () => document.getElementById('bankTableBody'),
  log: () => document.getElementById('activityLog'),

  clearAll() {
    this.platformBody().innerHTML = '';
    this.bankBody().innerHTML = '';
    document.getElementById('platformCount').textContent = '0';
    document.getElementById('bankCount').textContent = '0';
    document.getElementById('platformTotal').textContent = '—';
    document.getElementById('bankTotal').textContent = '—';
    document.getElementById('diffTotal').textContent = '—';
    document.getElementById('issuesPanel').hidden = true;
    document.getElementById('issuesList').innerHTML = '';
    this.log().innerHTML = '';
  },

  renderRow(tbody, row, side) {
    const tr = document.createElement('tr');
    tr.dataset.id = row.id;
    tr.dataset.side = side;
    tr.dataset.index = row._index ?? '';
    tr.className = 'appearing';
    const displayAmount = side === 'bank' ? row.amount : signedAmount(row);
    tr.innerHTML = `
      <td class="mono">${row.id}</td>
      <td>${row.type}</td>
      <td class="mono">${row.date}</td>
      <td class="amount mono">${formatRupees(displayAmount)}</td>
      <td class="status-cell"><span class="tag muted">pending</span></td>
    `;
    tbody.appendChild(tr);
    return tr;
  },

  findRow(side, id, index) {
    const tbody = side === 'platform' ? this.platformBody() : this.bankBody();
    if (index !== undefined && index !== null && index !== '') {
      return tbody.querySelector(`tr[data-id="${id}"][data-index="${index}"]`);
    }
    return tbody.querySelector(`tr[data-id="${id}"]`);
  },

  setRowStatus(side, id, statusClass, tagHtml, index) {
    const tr = this.findRow(side, id, index);
    if (!tr) return;
    tr.classList.remove('status-matched', 'status-unmatched', 'status-duplicate', 'status-orphan');
    if (statusClass) tr.classList.add(statusClass);
    tr.querySelector('.status-cell').innerHTML = tagHtml;
  },

  flashRow(side, id, index) {
    const tr = this.findRow(side, id, index);
    if (!tr) return;
    tr.classList.add('active');
    setTimeout(() => tr.classList.remove('active'), 500);
  },

  setTotal(id, value) {
    const el = document.getElementById(id);
    el.textContent = formatRupees(value);
    const card = el.closest('.card');
    card.classList.remove('updated');
    void card.offsetWidth;
    card.classList.add('updated');
  },

  showIssues(issues) {
    const panel = document.getElementById('issuesPanel');
    const list = document.getElementById('issuesList');
    panel.hidden = false;
    if (!issues.length) {
      list.innerHTML = '<div class="issue"><strong>All clear.</strong> No issues detected.</div>';
      return;
    }
    list.innerHTML = issues.map(i => `
      <div class="issue"><strong>${i.title}:</strong> ${i.detail}</div>
    `).join('');
  },

  logMsg(msg, level = 'info') {
    const el = this.log();
    const ts = new Date().toTimeString().slice(0, 8);
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.innerHTML = `<span class="ts">${ts}</span><span class="msg">${msg}</span>`;
    el.appendChild(entry);
    el.scrollTop = el.scrollHeight;
  },

  setButtonEnabled(id, enabled) {
    document.getElementById(id).disabled = !enabled;
  },
};

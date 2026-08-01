const sidebar = document.querySelector('.sidebar');
const right = document.querySelector('.right-region');
const chat = document.querySelector('.chat-panel');

document.querySelector('#collapse').addEventListener('click', () => sidebar.classList.toggle('rail'));
document.querySelector('#close-files').addEventListener('click', () => {
  right.classList.add('closed');
  chat.classList.add('expanded');
});

document.querySelectorAll('.session-item').forEach(item => item.addEventListener('click', () => {
  document.querySelectorAll('.session-item').forEach(node => node.classList.remove('current'));
  item.classList.add('current');
}));

document.querySelectorAll('.group-title').forEach(button => button.addEventListener('click', () => {
  const group = button.closest('.session-group');
  [...group.querySelectorAll('.session-item')].forEach(item => item.hidden = !item.hidden);
}));

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach(node => node.classList.remove('selected'));
  button.classList.add('selected');
  document.querySelector('.file-grid').classList.toggle('list', button.dataset.view === 'list');
}));

document.querySelector('.search input').addEventListener('input', event => {
  const query = event.target.value.toLowerCase();
  document.querySelectorAll('.file-card').forEach(card => {
    card.hidden = !card.textContent.toLowerCase().includes(query);
  });
});

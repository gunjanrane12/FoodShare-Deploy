// Fetch and display past food posts for the restaurant
document.addEventListener('DOMContentLoaded', () => {

    fetch('/api/restaurant/details')
        .then(response => response.json())
        .then(restaurant => {
            const el = document.getElementById('restaurantName');
            if (el) el.innerText = restaurant.name;
        })
        .catch(err => console.error('Error fetching restaurant details:', err));

    fetch('/api/restaurant/posts')
        .then(response => response.json())
        .then(pastPosts => {
            const container = document.getElementById('pastPostsOverview');
            const countEl = document.getElementById('postsCount');
            if (countEl) countEl.textContent = `${pastPosts.length} post${pastPosts.length !== 1 ? 's' : ''}`;

            if (pastPosts.length === 0) {
                container.innerHTML = `
                  <div class="empty-state">
                    <div class="empty-icon">🍽️</div>
                    <h3>No posts yet</h3>
                    <p>Click "Add Post" to share your first surplus food donation.</p>
                  </div>`;
                return;
            }

            pastPosts.forEach(post => {
                const statusBadge = post.status === 'active'
                    ? '<span class="badge badge-active">● Active</span>'
                    : post.status === 'accepted'
                        ? '<span class="badge badge-accepted">✓ Accepted</span>'
                        : '<span class="badge badge-expired">Expired</span>';

                const el = document.createElement('div');
                el.className = 'post-card-item';
                el.innerHTML = `
                    <div class="post-card-header">
                        <h3>${post.food_title}</h3>
                        ${statusBadge}
                    </div>
                    <div class="post-card-meta">
                        <div class="post-meta-row"><span>🍱</span> ${post.meal_quantity} meals</div>
                        <div class="post-meta-row"><span>⏰</span> ${new Date(post.expiry).toLocaleString()}</div>
                    </div>
                    <div class="post-card-actions">
                        <button class="btn btn-danger btn-sm delete-btn" data-id="${post.id}">🗑 Delete</button>
                        ${post.status === 'active' ? `<button class="btn btn-success btn-sm" onclick="markAsAccepted(${post.id})">✓ Mark Accepted</button>` : ''}
                    </div>
                `;
                container.appendChild(el);

                el.querySelector('.delete-btn').addEventListener('click', function () {
                    const postId = this.getAttribute('data-id');
                    if (confirm('Delete this food post?')) deletePost(postId, el);
                });
            });
        })
        .catch(err => {
            console.error('Error fetching posts:', err);
            document.getElementById('pastPostsOverview').innerHTML = '<p style="color:var(--clr-danger)">Error loading posts.</p>';
        });
});

document.getElementById('logoutButton').addEventListener('click', () => {
    fetch('/api/logout')
        .then(() => { window.location.href = '/'; })
        .catch(err => console.error('Logout error:', err));
});

function deletePost(postId, element) {
    fetch(`/api/food/delete/${postId}`, { method: 'DELETE' })
        .then(res => {
            if (res.ok) { element.remove(); }
            else { alert('Failed to delete post.'); }
        })
        .catch(err => console.error('Delete error:', err));
}

function markAsAccepted(postId) {
    fetch(`/api/food/mark-accepted/${postId}`, { method: 'POST' })
        .then(res => {
            if (res.ok) { location.reload(); }
            else { alert('Error marking as accepted.'); }
        });
}

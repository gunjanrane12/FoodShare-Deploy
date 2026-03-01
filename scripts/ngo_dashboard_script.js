document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/ngo/details')
        .then(res => res.json())
        .then(ngo => {
            const el = document.getElementById('ngoName');
            if (el) el.innerText = ngo.name;
        })
        .catch(err => console.error('Error fetching NGO details:', err));

    fetch('/api/food/available')
        .then(res => res.json())
        .then(posts => {
            const container = document.getElementById('foodPostsOverview');
            const countEl = document.getElementById('postsCount');
            if (countEl) countEl.textContent = `${posts.length} post${posts.length !== 1 ? 's' : ''}`;

            if (posts.length === 0) {
                container.innerHTML = `
              <div class="empty-state">
                <div class="empty-icon">🍽️</div>
                <h3>No food available right now</h3>
                <p>Check back soon — restaurants in your city will post surplus food here.</p>
              </div>`;
                return;
            }

            posts.forEach(post => {
                const expiry = new Date(post.expiry);
                const timeStr = expiry.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

                const card = document.createElement('div');
                card.className = 'food-post-card';
                card.innerHTML = `
                <div class="food-post-title">${post.food_title}</div>
                <div class="food-post-meta">
                    <span class="food-meta-chip">🍱 ${post.meal_quantity} meals</span>
                    <span class="food-meta-chip">📍 ${post.restaurant_city}</span>
                </div>
                <div class="food-post-expiry">⏰ Expires: ${timeStr}</div>
                <div class="food-post-actions">
                    <button class="btn btn-outline btn-sm toggle-button">View Restaurant Details</button>
                </div>
            `;

                card.querySelector('.toggle-button').addEventListener('click', () => {
                    const modal = document.getElementById('detailsModal');
                    const modalContent = document.getElementById('modalDetailsContent');

                    modalContent.innerHTML = `
                    <div class="modal-detail-row">
                        <div class="modal-detail-icon">🏪</div>
                        <div>
                            <div class="modal-detail-label">Restaurant</div>
                            <div class="modal-detail-value">${post.restaurant_name}</div>
                        </div>
                    </div>
                    <div class="modal-detail-row">
                        <div class="modal-detail-icon">📞</div>
                        <div>
                            <div class="modal-detail-label">Mobile</div>
                            <div class="modal-detail-value">${post.restaurant_mobile}</div>
                        </div>
                    </div>
                    <div class="modal-detail-row">
                        <div class="modal-detail-icon">📍</div>
                        <div>
                            <div class="modal-detail-label">City</div>
                            <div class="modal-detail-value">${post.restaurant_city}</div>
                        </div>
                    </div>
                    <div class="modal-detail-row">
                        <div class="modal-detail-icon">🏠</div>
                        <div>
                            <div class="modal-detail-label">Address</div>
                            <div class="modal-detail-value">${post.restaurant_address}</div>
                        </div>
                    </div>
                `;
                    modal.classList.add('open');
                });

                container.appendChild(card);
            });
        })
        .catch(err => {
            console.error('Error fetching food posts:', err);
            document.getElementById('foodPostsOverview').innerHTML =
                '<p style="color:var(--clr-danger)">Error loading food posts.</p>';
        });

    // Close modal
    document.querySelector('.close-button').addEventListener('click', () => {
        document.getElementById('detailsModal').classList.remove('open');
    });
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detailsModal');
        if (e.target === modal) modal.classList.remove('open');
    });
});

document.getElementById('logoutButton').addEventListener('click', () => {
    fetch('/api/logout')
        .then(() => { window.location.href = '/'; })
        .catch(err => console.error('Logout error:', err));
});

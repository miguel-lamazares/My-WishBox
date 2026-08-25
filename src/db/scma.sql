CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    jid VARCHAR(255) NOT NULL UNIQUE,

    budget NUMERIC(14, 2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS wishlist_items (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    name VARCHAR(500) NOT NULL,

    price NUMERIC(14, 2),

    url TEXT,

    image_url TEXT,

    category VARCHAR(100) NOT NULL DEFAULT 'general',

    priority SMALLINT NOT NULL DEFAULT 1,

    bought BOOLEAN NOT NULL DEFAULT FALSE,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_wishlist_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT wishlist_priority_check
        CHECK (
            priority BETWEEN 1 AND 4
        ),

    CONSTRAINT wishlist_price_check
        CHECK (
            price IS NULL OR price >= 0
        )
);


CREATE INDEX IF NOT EXISTS idx_wishlist_user_id
    ON wishlist_items(user_id);


CREATE INDEX IF NOT EXISTS idx_wishlist_user_category
    ON wishlist_items(user_id, category);


CREATE INDEX IF NOT EXISTS idx_wishlist_user_priority
    ON wishlist_items(user_id, priority);


CREATE INDEX IF NOT EXISTS idx_wishlist_user_bought
    ON wishlist_items(user_id, bought);


CREATE INDEX IF NOT EXISTS idx_wishlist_user_name
    ON wishlist_items(user_id, name);
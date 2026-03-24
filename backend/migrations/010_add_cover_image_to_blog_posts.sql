-- Migration: 010_add_cover_image_to_blog_posts
-- Adds an optional cover image URL column to the blog_posts table.

ALTER TABLE blog_posts
    ADD COLUMN cover_image VARCHAR(2048) NULL DEFAULT NULL AFTER status;

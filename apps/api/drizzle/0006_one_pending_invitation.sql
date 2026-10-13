-- One pending invitation per person per household (OQ-118): two simultaneous
-- invitations can no longer both be created.
CREATE UNIQUE INDEX "invitations_one_pending_key" ON "invitations" USING btree ("household_id","invited_user_id") WHERE "invitations"."status" = 'pending';
START TRANSACTION;

INSERT INTO `user` (
  `id`,
  `name`,
  `email`,
  `emailVerified`,
  `image`,
  `password`,
  `createdAt`,
  `updatedAt`
) VALUES (
  '29966099-3970-454d-88f3-45fab89bac65',
  'innoc',
  NULL,
  NULL,
  NULL,
  '$2b$12$8wNf9zKb.jmXXbjMWb.8huqDgE2u3UYBlaBXJhK1.h1H1RvTHUlvu',
  '2026-04-11 23:23:21.103',
  '2026-04-14 14:19:01.892'
);

INSERT INTO `user_balances` (
  `id`,
  `userId`,
  `balance`,
  `frozenAmount`,
  `totalSpent`,
  `createdAt`,
  `updatedAt`
) VALUES (
  'bb24ee21-a17e-41df-af2b-9820cca7a849',
  '29966099-3970-454d-88f3-45fab89bac65',
  0,
  0,
  0,
  '2026-04-11 23:23:21.103',
  '2026-04-14 14:19:01.892'
);

INSERT INTO `projects` (
  `id`,
  `name`,
  `description`,
  `userId`,
  `createdAt`,
  `updatedAt`,
  `lastAccessedAt`
) VALUES (
  '411508ef-8469-4fa8-ac3b-7b1da1b9a3ab',
  '双界猎场',
  NULL,
  '29966099-3970-454d-88f3-45fab89bac65',
  '2026-04-11 23:23:21.103',
  '2026-04-14 14:19:01.892',
  '2026-04-14 14:19:01.892'
);

INSERT INTO `novel_promotion_projects` (
  `id`,
  `projectId`,
  `createdAt`,
  `updatedAt`
) VALUES (
  'bad1e1aa-0c1d-4d6b-ad48-0bd2b0da2acb',
  '411508ef-8469-4fa8-ac3b-7b1da1b9a3ab',
  '2026-04-11 23:23:21.103',
  '2026-04-14 14:19:01.892'
);

COMMIT;

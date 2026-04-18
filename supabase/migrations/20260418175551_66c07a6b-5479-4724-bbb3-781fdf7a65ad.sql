-- Replace existing Big Five question bank with a stronger 50-item IPIP-NEO inspired set
DELETE FROM public.assessment_questions;

INSERT INTO public.assessment_questions (trait, text, reversed, sort_order, is_active) VALUES
-- Openness (10)
('openness', 'J''ai une imagination débordante et je trouve facilement des idées originales.', false, 1, true),
('openness', 'J''évite les sujets philosophiques ou abstraits car ils me semblent inutiles.', true, 2, true),
('openness', 'J''aime explorer des idées nouvelles, même si elles bousculent mes convictions.', false, 3, true),
('openness', 'Je préfère la routine et les méthodes éprouvées plutôt que d''essayer de nouvelles approches.', true, 4, true),
('openness', 'Je suis curieux(se) de découvrir d''autres cultures, langues ou disciplines.', false, 5, true),
('openness', 'L''art, la musique ou la littérature ne me touchent pas particulièrement.', true, 6, true),
('openness', 'Je remets volontiers en question les règles établies quand elles n''ont plus de sens.', false, 7, true),
('openness', 'Je trouve les discussions théoriques ennuyeuses.', true, 8, true),
('openness', 'J''ai souvent des idées qui surprennent les autres par leur originalité.', false, 9, true),
('openness', 'Je préfère des tâches concrètes plutôt que de réfléchir à des concepts abstraits.', true, 10, true),

-- Conscientiousness (10)
('conscientiousness', 'Je termine systématiquement ce que j''ai commencé, même quand cela devient difficile.', false, 11, true),
('conscientiousness', 'Il m''arrive souvent de remettre à plus tard des tâches importantes.', true, 12, true),
('conscientiousness', 'Je planifie mes journées et je respecte mon planning.', false, 13, true),
('conscientiousness', 'Je laisse souvent mon espace de travail en désordre.', true, 14, true),
('conscientiousness', 'Je vérifie mon travail plusieurs fois pour éviter les erreurs.', false, 15, true),
('conscientiousness', 'Je perds régulièrement des objets ou j''oublie des engagements.', true, 16, true),
('conscientiousness', 'Je tiens parole, même quand cela me coûte du temps ou de l''effort.', false, 17, true),
('conscientiousness', 'Je commence beaucoup de projets sans en finir aucun.', true, 18, true),
('conscientiousness', 'Quand je m''engage sur un délai, je m''arrange pour le tenir.', false, 19, true),
('conscientiousness', 'Je travaille mieux sous pression de dernière minute que de manière organisée.', true, 20, true),

-- Extraversion (10)
('extraversion', 'Je me sens à l''aise pour prendre la parole devant un groupe.', false, 21, true),
('extraversion', 'Je préfère rester en retrait dans les réunions plutôt que d''attirer l''attention.', true, 22, true),
('extraversion', 'Rencontrer de nouvelles personnes me donne de l''énergie.', false, 23, true),
('extraversion', 'Les longues interactions sociales m''épuisent rapidement.', true, 24, true),
('extraversion', 'J''engage facilement la conversation, même avec des inconnus.', false, 25, true),
('extraversion', 'Je préfère travailler seul(e) que dans une équipe nombreuse.', true, 26, true),
('extraversion', 'Je suis souvent celui(celle) qui anime ou structure les discussions.', false, 27, true),
('extraversion', 'Dans un groupe, j''attends qu''on me sollicite avant d''intervenir.', true, 28, true),
('extraversion', 'J''aime les environnements dynamiques avec beaucoup d''interactions.', false, 29, true),
('extraversion', 'J''ai besoin de longs moments de calme et de solitude pour récupérer.', true, 30, true),

-- Agreeableness (10)
('agreeableness', 'Je fais facilement confiance aux nouvelles personnes que je rencontre.', false, 31, true),
('agreeableness', 'Je suppose souvent que les autres ont des intentions cachées.', true, 32, true),
('agreeableness', 'J''écoute attentivement les points de vue qui s''opposent au mien.', false, 33, true),
('agreeableness', 'En cas de désaccord, j''ai tendance à imposer mon avis.', true, 34, true),
('agreeableness', 'J''aide volontiers un collègue, même quand ce n''est pas mon rôle.', false, 35, true),
('agreeableness', 'Je trouve qu''aider les autres me ralentit dans mon propre travail.', true, 36, true),
('agreeableness', 'Je cherche des solutions gagnant-gagnant plutôt que d''imposer la mienne.', false, 37, true),
('agreeableness', 'Je n''hésite pas à utiliser la critique pour faire avancer les choses.', true, 38, true),
('agreeableness', 'Je m''efforce de comprendre ce que ressentent les autres avant de juger.', false, 39, true),
('agreeableness', 'Je trouve que beaucoup de gens méritent leurs problèmes.', true, 40, true),

-- Neuroticism (10)
('neuroticism', 'Je m''inquiète facilement, même pour des choses peu importantes.', false, 41, true),
('neuroticism', 'Je reste calme et serein(e) face à la pression.', true, 42, true),
('neuroticism', 'Mon humeur peut changer brusquement sans raison claire.', false, 43, true),
('neuroticism', 'J''accepte les critiques sans me sentir blessé(e).', true, 44, true),
('neuroticism', 'Je rumine longtemps après une situation difficile.', false, 45, true),
('neuroticism', 'Je me remets rapidement après un échec ou une déception.', true, 46, true),
('neuroticism', 'Je me sens souvent submergé(e) par les responsabilités.', false, 47, true),
('neuroticism', 'Je gère mes émotions de manière équilibrée, même dans les moments tendus.', true, 48, true),
('neuroticism', 'Je me sens parfois découragé(e) ou triste sans motif particulier.', false, 49, true),
('neuroticism', 'Face à un imprévu, je garde mon sang-froid sans paniquer.', true, 50, true);
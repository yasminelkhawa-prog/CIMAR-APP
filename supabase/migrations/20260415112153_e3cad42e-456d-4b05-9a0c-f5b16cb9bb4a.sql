
CREATE TABLE public.assessment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trait TEXT NOT NULL CHECK (trait IN ('openness','conscientiousness','extraversion','agreeableness','neuroticism')),
  text TEXT NOT NULL,
  reversed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active questions" ON public.assessment_questions FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage questions" ON public.assessment_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.assessment_questions (trait, text, reversed, sort_order) VALUES
('openness', 'Je suis curieux(se) et j''aime découvrir de nouvelles idées.', false, 1),
('openness', 'Je préfère la routine aux nouvelles expériences.', true, 2),
('openness', 'J''apprécie l''art, la musique et la créativité.', false, 3),
('conscientiousness', 'Je suis organisé(e) et je planifie mes tâches à l''avance.', false, 4),
('conscientiousness', 'Il m''arrive souvent de remettre les choses à plus tard.', true, 5),
('conscientiousness', 'Je suis rigoureux(se) et attentif(ve) aux détails.', false, 6),
('extraversion', 'Je me sens à l''aise dans les groupes et les événements sociaux.', false, 7),
('extraversion', 'Je préfère travailler seul(e) plutôt qu''en équipe.', true, 8),
('extraversion', 'Je prends facilement la parole en public.', false, 9),
('agreeableness', 'Je fais confiance aux autres facilement.', false, 10),
('agreeableness', 'J''ai tendance à être critique envers les autres.', true, 11),
('agreeableness', 'J''aime aider les autres, même si cela me demande un effort.', false, 12),
('neuroticism', 'Je m''inquiète souvent pour des choses qui pourraient mal tourner.', false, 13),
('neuroticism', 'Je reste calme même dans des situations stressantes.', true, 14),
('neuroticism', 'Mes émotions changent rapidement.', false, 15);

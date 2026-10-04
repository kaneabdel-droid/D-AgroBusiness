CREATE TABLE IF NOT EXISTS public.maketou_produits (
    niveau text NOT NULL,
    mois integer NOT NULL,
    product_id text NOT NULL,
    PRIMARY KEY (niveau, mois)
);
ALTER TABLE public.maketou_produits ENABLE ROW LEVEL SECURITY;

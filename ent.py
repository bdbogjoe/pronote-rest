from functools import partial
from pronotepy.ent.generic_func import (  # type: ignore
    _cas,
    _cas_edu,
    _open_ent_ng_edu,
    _open_ent_ng,
    _wayf,
    _oze_ent,
    _simple_auth,
)
vth_ecollege_haute_garonne_edu = partial(
    _cas_edu,
    url="https://cas.ecollege.haute-garonne.fr/login?selection=EDU_parent_eleve&service=https://marcel-doret.ecollege.haute-garonne.fr/sg.do?PROC=IDENTIFICATION_FRONT&ACTION=VALIDER",
)
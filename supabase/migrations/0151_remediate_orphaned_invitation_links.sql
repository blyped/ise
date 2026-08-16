-- 0151 — remediation des 50 comptes provisionnes cette nuit malgre le bug 0150.
--
-- Contexte : entre 02:41 et 02:45 UTC (16/08), le premier lot reel de relance
-- d'invitations (#203, limit=50) a tourne pendant que private.provision_referenced_account
-- avait deux surcharges ambigues (voir 0150). L'Edge Function provision-invitations
-- appelle d'abord auth.admin.inviteUserByEmail() PUIS le rattachement RPC : les 50
-- comptes auth.users ont donc bien ete crees et les e-mails d'invitation Resend
-- envoyes, mais le rattachement a ise_profiles.user_id a echoue a chaque fois
-- (42725 function ... is not unique), laissant 50 profils "unclaimed" avec un
-- compte auth.users orphelin. Verifie par jointure auth.users / private.profile_contacts
-- / public.ise_profiles sur les creations des dernieres 24h : exactement 50 paires,
-- toutes non liees (user_id IS NULL, claim_status='unclaimed').
--
-- Correctif : rejoue le rattachement pour ces 50 paires (profile_id, user_id) avec la
-- fonction desormais univoque (0150). Sans cette remediation, un futur lot relancerait
-- inviteUserByEmail() pour ces memes profils, recevrait "email_exists" (compte deja
-- cree), les marquerait "skipped" et ne retenterait plus jamais le rattachement : ces
-- 50 personnes resteraient bloquees indefiniment malgre un e-mail d'invitation deja
-- recu et un compte auth.users deja actif.

do $$
declare
  r record;
  ok_count int := 0;
  err_count int := 0;
begin
  for r in
    select * from (values
      ('8833496c-519f-4266-8807-2eff0225e692'::uuid,'b0d4c9ec-cdcb-408c-973d-740e9d1cb6bb'::uuid),
      ('32760632-cb1f-4202-aae1-9f97052637ab'::uuid,'314476e7-8091-4c41-89c1-5e04433ee283'::uuid),
      ('5721651d-5414-4b98-b387-04cb63e6c3c6'::uuid,'97947161-4123-4d05-bc73-eca1a3a60bbe'::uuid),
      ('6ec8b9a2-3c28-40bd-94e0-b19deb5735b5'::uuid,'a1fc2d56-b945-4bb7-8f72-9867144c5889'::uuid),
      ('7a5e9c4e-52bd-4d82-b33e-5b3898d8be36'::uuid,'a94dca9f-cba1-4fcd-bf0b-c6bd6fcbbd72'::uuid),
      ('a957d7e8-ae1f-48f7-bc05-30e4b8d874f7'::uuid,'e1b039e8-93ed-4d13-b573-1ea36654dedf'::uuid),
      ('25a8fd97-71bb-4e39-bc86-9e4e9e08b88d'::uuid,'ab269b43-bfdd-4aa9-9c38-8fdd000e5d5d'::uuid),
      ('2184f4a7-0d81-41fe-ae92-dd705ed66276'::uuid,'0639b53f-57f8-4558-8d7e-0d67e6c95bde'::uuid),
      ('27d22fd1-bf02-4336-93eb-da5eb15184a1'::uuid,'bab9ecc6-490e-403e-bfd0-4c69702bcf6a'::uuid),
      ('18aa358b-9721-4263-b70a-bec5c5fa48aa'::uuid,'087d3d30-b47f-4ad5-a976-2e28173630a7'::uuid),
      ('47937c85-5881-45ae-bab4-97530b244fad'::uuid,'0c03a604-01b1-44bd-bf0b-e60cba70936a'::uuid),
      ('2ffe7db8-52cd-4bfe-b8f0-bf0f3590a3f4'::uuid,'8a10ceeb-7524-47eb-aefd-41ab298ce158'::uuid),
      ('b3fd4038-a0de-4045-82a3-21a4e9c70172'::uuid,'c2882f3c-d404-4142-8cc6-bfe078953a61'::uuid),
      ('c73788c7-2a3d-4627-b370-f54c25515f2e'::uuid,'6a20521b-6af8-4864-a3ac-b4c9c32e1793'::uuid),
      ('8aafedfd-6e5c-45f8-bf1f-fe5d6e2c119a'::uuid,'13030659-4c69-46d1-807d-558d23d9941c'::uuid),
      ('50ddc98a-4c2b-43fb-8e20-565f6ab774ea'::uuid,'e793e7e0-cf1b-46c2-a9be-96bfa95b6650'::uuid),
      ('e476b212-6b25-46d7-a433-b730ba5ac6c8'::uuid,'5b69924a-a927-46a9-9a00-279e35bec9bb'::uuid),
      ('106fa5e3-b1ed-44c6-ad06-ef2752fde7e2'::uuid,'b42368b1-92cc-4ca8-9036-5b362ab3c2a8'::uuid),
      ('354d17f5-93bf-4b46-8471-4c6423bb229f'::uuid,'b6ef6089-d644-45b9-9947-2f27a312ab51'::uuid),
      ('615edabe-08eb-40cb-a0a8-a0033411b7b9'::uuid,'c66a10ca-98a3-4f0d-b5c0-dbf4511a6ce4'::uuid),
      ('2c38e752-fbbc-4f77-9542-bcae326f1e65'::uuid,'09af1dfa-8ba4-4486-98dd-4a329cd9a387'::uuid),
      ('f7732640-56e3-4799-99d0-959b92085766'::uuid,'d2c57e9b-2d7c-455b-bf7a-181c3deb5aa3'::uuid),
      ('10f2e3d1-9c42-474d-9112-cbffc535435f'::uuid,'c8da86d8-c7ad-44ce-ad6d-b3c46578a537'::uuid),
      ('4ca17259-b012-43e4-a310-c4e1486dcc24'::uuid,'8eba4d0b-b37c-4214-b65a-e838ad9d593e'::uuid),
      ('3ef20763-dfea-4f1e-ab37-565fc22a2633'::uuid,'45ed2e0a-a3ad-45e0-a9ae-e88e4928c3ac'::uuid),
      ('a94a030b-c440-4390-a334-6086bc9b2f5f'::uuid,'1023a74d-5a33-4340-9b1d-10ae6a45f6c3'::uuid),
      ('4c8ae200-c232-4859-a80c-571accef9d0d'::uuid,'95cb7dd5-81ce-4416-a410-8d55195986d9'::uuid),
      ('e082cc86-06a9-45b8-85d6-1ca83e2432be'::uuid,'5a5aae68-c6e3-46af-bc36-5bb788672ac0'::uuid),
      ('1d4e8764-fcd2-47dc-9780-1a69ad8549cf'::uuid,'9c89efa4-fc3d-414e-8b1a-2ad2d7bc22bc'::uuid),
      ('096521cb-6de4-462f-8229-455c744bdb1a'::uuid,'d1ce60f6-64eb-4eb3-b22f-4635ed6888ad'::uuid),
      ('33980aa2-a07f-4917-a7f9-2801b32eacc2'::uuid,'031b5d82-bc26-4cb4-8f33-f8932c1825d7'::uuid),
      ('eae7cd69-6711-442b-b3ec-6956285160f9'::uuid,'ecf8f42e-6b3e-48ba-ac21-dd0bdbe7b389'::uuid),
      ('a0acb63c-fed3-4a0a-bbbd-9037dbed76bc'::uuid,'fa33bf83-1451-43a8-8336-a64c11a149f9'::uuid),
      ('104cf5ca-cdf2-45be-9129-908e13e6cf31'::uuid,'05ece7b7-898f-4d99-bccb-6d4f1d29bf12'::uuid),
      ('b7e16dd8-0d1a-4b7a-bfcd-e58a585c5551'::uuid,'11eca4c4-fcfc-457f-aa72-777de2b5a186'::uuid),
      ('a7aa3631-7073-4861-ae79-69849bad43f9'::uuid,'f9620de6-223b-4819-9b38-83caa4d75f77'::uuid),
      ('e2f6c350-4476-4468-ac7d-15293643467e'::uuid,'88704736-cb3e-4e47-a53b-6580fe8e9ab9'::uuid),
      ('403e43bc-3df5-4d66-85a4-799d77f9063b'::uuid,'f9d7b6e2-9f0f-4e46-938a-6f1404308eb1'::uuid),
      ('c63d1338-d563-489a-9cc6-fbebba5e1d7f'::uuid,'7a03b3d8-d486-4133-939c-a7106261f275'::uuid),
      ('ec77fd0d-7c67-418e-aa4e-d5a417d29ea7'::uuid,'41875963-6084-4496-ba4e-e15b9a38de06'::uuid),
      ('7c8f965c-c4fc-4252-be34-7cee3f752909'::uuid,'8d140e98-b989-4cca-8dcb-98db24a5c1df'::uuid),
      ('07e746b1-cdb9-46dd-819c-dd898da64ac1'::uuid,'00cc4a45-7816-4b33-9a4e-7fd1d21be9bd'::uuid),
      ('945a284c-7bd9-44b1-bda3-2d6243d86dcb'::uuid,'d5efc89a-a763-413e-a41d-a8be5867ab9f'::uuid),
      ('4f69f411-912b-41b5-a99a-3253037f0c38'::uuid,'70f5dbd3-f3fc-445e-9e72-3dd53cbd2789'::uuid),
      ('b091bd36-22e5-41ea-9d5e-c1a3c6c98d3d'::uuid,'be17e6b5-103b-49cb-bc1d-3ce4b464a8ac'::uuid),
      ('c3824e07-c9be-4a74-b65f-2d439f7fa974'::uuid,'27b1a4cd-2981-43f1-9ef4-0c0475716701'::uuid),
      ('4167da64-2830-4647-aaa2-850992cff7a4'::uuid,'6d00e1ae-f383-4e4e-8a5a-60ba166c12c6'::uuid),
      ('578278fa-f465-4088-b89d-3f52de2148f0'::uuid,'32cce9ac-654b-4925-94e8-749db72d0080'::uuid),
      ('26dfaf47-404c-463c-88dc-db829534bc83'::uuid,'c6980b92-8526-44dd-adbc-a9e986834f77'::uuid),
      ('3616341e-588b-4ad5-96f0-ceae9bc1d7fc'::uuid,'16164852-9e6f-48b7-bf11-c7fd4f82bbc9'::uuid)
    ) as t(profile_id, user_id)
  loop
    begin
      perform private.provision_referenced_account(r.profile_id, r.user_id, 'invite_link');
      ok_count := ok_count + 1;
    exception when others then
      err_count := err_count + 1;
      raise notice 'ECHEC profile % user % : %', r.profile_id, r.user_id, sqlerrm;
    end;
  end loop;
  raise notice 'TERMINE: % succes, % echecs', ok_count, err_count;
end $$;

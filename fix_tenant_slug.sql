-- Script para corrigir o slug do tenant "Lanchonete da Família"
UPDATE tenants 
SET slug = 'lanchonetedafamilia' 
WHERE slug = 'lanchonetdafamilia';

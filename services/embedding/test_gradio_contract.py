import unittest
from gradio_contract import validate_request
from model import MODEL_VERSION


class GradioContractTests(unittest.TestCase):
    def test_token_validation_precedes_gpu_input_validation(self):
        with self.assertRaisesRegex(ValueError, 'Unauthorized'):
            validate_request(None, 'wrong', 'x' * 32)

    def test_query_and_passage_batch_contract(self):
        self.assertEqual(validate_request({'texts':[' Ri6 '],'kind':'query','modelVersion':MODEL_VERSION},'x'*32,'x'*32),(['Ri6'],'query'))
        payload={'texts':['Ri6','Mít'],'kind':'passage','modelVersion':MODEL_VERSION}
        self.assertEqual(validate_request(payload,'x'*32,'x'*32),(['Ri6','Mít'],'passage'))
        self.assertEqual(len(validate_request({**payload,'texts':['x'*8000]},'x'*32,'x'*32)[0][0]),8000)
        with self.assertRaises(ValueError):
            validate_request({**payload,'kind':'query','texts':['x'*601]},'x'*32,'x'*32)
        for update in ({'texts':[]},{'texts':['x']*17},{'texts':['x'*8001]},{'texts':[' ']},{'kind':'unknown'},{'modelVersion':'other'}):
            with self.assertRaises(ValueError):
                validate_request({**payload,**update},'x'*32,'x'*32)

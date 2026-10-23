import {useState} from 'react';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test} from 'vitest';
import {FruitCombobox} from './fruit-combobox';
import {testCatalog} from '../../features/farmer/lots/lot.fixtures';
test('unaccented suggestions select canonical IDs and typing clears a previous selection',async()=>{
 function Form(){const [ids,setIds]=useState(['fruit-1','variety-1']);return <><FruitCombobox catalog={testCatalog} fruitId={ids[0]} varietyId={ids[1]} onChange={(f,v)=>setIds([f,v])}/><output>{ids.join(':')}</output></>;}
 render(<Form/>);const input=screen.getByRole('combobox');expect(input).toHaveValue('Sầu riêng · Ri6');
 await userEvent.clear(input);await userEvent.type(input,'sau rieng');expect(screen.getByRole('status')).toHaveTextContent(':');
 await userEvent.keyboard('{ArrowDown}{Enter}');expect(input).toHaveValue('Sầu riêng · Ri6');expect(screen.getByRole('status')).toHaveTextContent('fruit-1:variety-1');
 await userEvent.clear(input);await userEvent.type(input,'mit');await userEvent.click(screen.getByRole('option',{name:'Mít'}));expect(screen.getByRole('status')).toHaveTextContent('fruit-2:');
 await userEvent.clear(input);await userEvent.type(input,'quả không tồn tại');await userEvent.tab();expect(screen.getByRole('status')).toHaveTextContent(':');
});
